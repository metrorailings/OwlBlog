global.OwlStakes =
{
	require : require('app-root-path').require
};

// ----------------- EXTERNAL MODULES --------------------------

var _fs = require('fs'),

	mongo = global.OwlStakes.require('databaseDriver');

// ----------------- ENUMS/CONSTANTS --------------------------

var GAMES_COLLECTION = 'games',
	ELO_COLLECTION = 'elo',

	OUTPUT_FILE = 'data/games/',
	JSON_EXTENSION = '.json';

// ----------------- CURVE EFFECTS --------------------------

var CURVES = new Map();

CURVES.set(-5, -8);
CURVES.set(-4, -5);
CURVES.set(-3, -3);
CURVES.set(-2, -2);
CURVES.set(-1, -1);
CURVES.set(0, 0);
CURVES.set(1, 1);
CURVES.set(2, 2);
CURVES.set(3, 3);
CURVES.set(4, 5);
CURVES.set(5, 8);

// ----------------- PRIVATE FUNCTIONS --------------------------

/**
 * Function responsible for rounding any number to the nearest legal spread
 *
 * @param {Number} spread - the spread to round
 *
 * @author kinsho
 */
function _roundSpread(spread)
{
	var ceiling = Math.ceil(spread),
		floor = Math.floor(spread),
		halfPoint = (ceiling + floor) / 2;

	// Figure out what legal value the given spread is closest to

	if (Math.abs(spread - floor) < 0.25)
	{
		return floor;
	}

	else if (Math.abs(spread - ceiling) < 0.25)
	{
		return ceiling;
	}

	else
	{
		return halfPoint;
	}
}

/**
 * Function responsible for determining the raw spread of any game by comparing the ELO scores of the two teams 
 *
 * @param {Number} homeEloScore - the home team's ELO score
 * @param {Number} awayEloScore - the away team's ELO score
 *
 * @author kinsho
 */
function _determineRawSpread(homeEloScore, awayEloScore)
{
	var eloDifferential = Math.abs(homeEloScore - awayEloScore),
		rawSpread = 0,
		benchmark = 25,
		keyNumbers = [3, 7, 10, 14];

	while (eloDifferential >= benchmark)
	{
		rawSpread += 1;
		eloDifferential -= benchmark;

		// Reset the benchmark
		benchmark = 25;

		// If the spread is on the cusp of crossing over a key number, adjust our benchmark
		for (let i = 0; i < keyNumbers.length; i += 1)
		{
			if (keyNumbers[i] === rawSpread + 1)
			{
				benchmark = 40;
			}
		}
	}

	// If any eloDifferential is left that has not been accounted into the spread yet, then we are dealing with a
	// fraction of a point here
	rawSpread += (eloDifferential / benchmark);

	return (homeEloScore > awayEloScore ? rawSpread : rawSpread * -1);
}

// ----------------- LOGIC --------------------------

(async function ()
{
	var week,
		eloMap = {},
		games, eloScores,
		homeEloScore, awayEloScore,
		owlSpread,
		databaseGames = [];

	await mongo.initialize();

	// Find the week that we need to fetch the game data from
	week = parseInt(process.argv[2]);

	// Note the week
	console.log('WEEK ---> ' + week);

	// For ineligible weeks, bail out of the program
	if (!week)
	{
		console.error('Pass in a legit week.');
		process.exit();
	}

	// Now retrieve game and ELO data corresponding to the week in context
	games = await mongo.read(GAMES_COLLECTION,
	{
		week: week
	});
	eloScores = await mongo.read(ELO_COLLECTION,
	{
		week: week
	});

	// Organize the ELO scores into a map indexed by team name
	for (let i = 0; i < eloScores.length; i += 1)
	{
		eloMap[eloScores[i].name] = eloScores[i];

		delete eloMap[eloScores[i].name].name;
	}

	// Now let's do the actual ELO number crunching to determine our proprietary spreads
	for (let i = 0; i < games.length; i += 1)
	{
		homeEloScore = eloMap[games[i].homeTeam].elo;
		awayEloScore = eloMap[games[i].awayTeam].elo;

		console.log(games[i].awayTeam + ' @ ' + games[i].homeTeam);
		console.log(games[i].awayTeam + ': ' + awayEloScore);
		console.log(games[i].homeTeam + ': ' + homeEloScore);
		console.log('Curve: ' + games[i].curve);

		// Calculate the point spread
		owlSpread = _determineRawSpread(homeEloScore, awayEloScore);

		// As the spread is calculated for the home team, account for the home team's home-field advantage
		// Note that the smaller crowds at home games this year (or nonexistant in some cases) will reduce the home
		// field advantage this year
		owlSpread += 1.5;

		// Account for any curves
		owlSpread += CURVES.get(games[i].curve);

		// Normalize the spread
		owlSpread *= -1;

		// If there's a significant difference between the Vegas spread and our spread, mark what team should be bet
		if (owlSpread - games[i].bookSpread >= 2.5)
		{
			games[i].pickAwayTeam = true;
			games[i].pickHomeTeam = false;
		}
		else if (owlSpread - games[i].bookSpread <= -2.5)
		{
			games[i].pickAwayTeam = false;
			games[i].pickHomeTeam = true;
		}
		else
		{
			games[i].pickAwayTeam = false;
			games[i].pickHomeTeam = false;
		}

		console.log('Unrounded spread: ' + owlSpread);
		games[i].owlSpread = _roundSpread(owlSpread);
		console.log('Rounded spread: ' + games[i].owlSpread);

		databaseGames.push(mongo.formUpdateOneQuery({ _id: games[i]._id }, games[i]));
	}

	// Push our proprietary spreads into the database
	databaseGames.unshift(GAMES_COLLECTION, true);
	await mongo.bulkWrite.apply(mongo, databaseGames);

	// Sort the games by date
	games.sort(function(a, b)
	{
		var dateA = new Date(a.date),
			dateB = new Date(b.date);

		if (dateA > dateB)
		{
			return 1;
		}
		else if (dateA < dateB)
		{
			return -1;
		}

		return 0;
	});

	// Write out the data
	_fs.writeFileSync(OUTPUT_FILE + week + JSON_EXTENSION, JSON.stringify({ games : games }));

	// Closing logic
	console.log('Done!');
	process.exit();
}());