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

	OUTPUT_FILE = 'data/elo/',
	JSON_EXTENSION = '.json',

	K_VALUE = 20;

// ----------------- PRIVATE VARIABLES --------------------------

// Collection of all ELO records indexed by team name
var _eloMap = {};

// ----------------- PRIVATE FUNCTIONS --------------------------

/**
 * Function meant to house all the logic responsible for figuring out how to update the ELO score
 *
 * @param {Object} game - the game which we will be analyzing
 *
 * @returns {Object} - the values to add to the ELO ratings of both teams involved in the game
 *
 * @author kinsho
 */
function _calculateEloChange(game)
{
	var homeTeam = game.homeTeam,
		awayTeam = game.awayTeam,
		homeElo = _eloMap[homeTeam].elo,
		awayElo = _eloMap[awayTeam].elo,
		scoreDifferential = game.homeTeamScore - game.awayTeamScore,
		underdogScore, favoriteScore,
		didFavoriteCover, didUnderdogWin,
		homeProbability, awayProbability,
		spreadPerformanceMultiplier = 1,
		homeEloShift, awayEloShift;

	// Calculate the probabilities both teams had of winning this game
	homeProbability = 1 / (1 + Math.pow(10, ( (awayElo - homeElo) / 400 ) ));
	awayProbability = 1 / (1 + Math.pow(10, ( (homeElo - awayElo) / 400 ) ));

	// Now calculate just how much to change each team's ELO scores depending on the ternary outcome of the game
	homeEloShift = K_VALUE * ((scoreDifferential > 0 ? 1 : (scoreDifferential < 0 ? 0 : 0.5) ) - homeProbability);
	awayEloShift = K_VALUE * ((scoreDifferential > 0 ? 0 : (scoreDifferential < 0 ? 1 : 0.5) ) - awayProbability);

	// Adjusting the ELO score to take MoV  into account
	// Remember that MoV is taken against the spread, now the raw score
	favoriteScore = (game.owlSpread > 0 ? game.awayTeamScore : game.homeTeamScore);
	underdogScore = (game.owlSpread > 0 ? game.homeTeamScore : game.awayTeamScore);
	didUnderdogWin = (underdogScore > favoriteScore);
	didFavoriteCover = ((favoriteScore - underdogScore) > Math.abs(game.owlSpread));

	// All formulas below increase the score differential by 2.5 before conducting any more operations. This is
	// done to guarantee the final spread multiplier is
	// - greater than 1 in the event that the underdog wins or the favorite covers
	// - less than 1 in the event that the favorite wins, but does not cover

	// Calculate the spread adjustment to the ELO shift depending on the outcome of the game
	if (didUnderdogWin)
	{
		// No need to add 1 here as underdogScore > favoriteScore
		spreadPerformanceMultiplier = Math.log(underdogScore - favoriteScore + 2.5);
	}
	else if (didFavoriteCover)
	{
		// No need to add 1 here as scoreDifferential > abs(owlSpread)
		spreadPerformanceMultiplier = Math.log(Math.abs(scoreDifferential) + 2.5 - Math.abs(game.owlSpread));
	}
	else
	{
		spreadPerformanceMultiplier = 1 / Math.log(Math.abs(game.owlSpread) + 2.5 - Math.abs(scoreDifferential));
	}

	// Document all the information we've calculated for this particular game
	console.log('----------------------------------------');
	console.log(awayTeam + ' @ ' + homeTeam);
	console.log(awayTeam + ': ' + awayElo);
	console.log(homeTeam + ': ' + homeElo);
	console.log(awayTeam + ': ' + (awayProbability * 100).toFixed(2) + '%');
	console.log(homeTeam + ': ' + (homeProbability * 100).toFixed(2) + '%');
	console.log(awayTeam + ': ' + awayEloShift.toFixed(2) + ' (Elo Shift)');
	console.log(homeTeam + ': ' + homeEloShift.toFixed(2) + ' (Elo Shift)');
	console.log('SPREAD: ' + game.owlSpread);
	console.log(awayTeam + ': ' + game.awayTeamScore);
	console.log(homeTeam + ': ' + game.homeTeamScore);
	if (didUnderdogWin)
	{
		console.log('Underdog won');
	}
	else if (didFavoriteCover)
	{
		console.log('Favorite covered');
	}
	else
	{
		console.log('Favorite won, but did not cover');
	}
	console.log('spreadMultiplier: ' + spreadPerformanceMultiplier.toFixed(2));
	console.log('----------------------------------------');

	// Now apply the multiplier to the shift value
	homeEloShift *= spreadPerformanceMultiplier;
	awayEloShift *= spreadPerformanceMultiplier;

	return {
		home: Math.round(homeEloShift),
		away: Math.round(awayEloShift)
	};
}

// ----------------- LOGIC --------------------------

(async function ()
{
	var week,
		games, eloScores = [],
		scoreDifferential,
		eloModifiers,
		teamNames,
		databaseElos = [];

	await mongo.initialize();

	// Find the week from which we will be calculating new ELO scores
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
		_eloMap[eloScores[i].name] = eloScores[i];
	}

	// Now let's do the actual number crunching to determine the new ELO scores
	for (let i = 0; i < games.length; i += 1)
	{
		scoreDifferential = games[i].homeTeamScore - games[i].awayTeamScore;

		// Modify the ELO scores depending on who won the game relative to the spread
		// Make sure to record the magnitude of the change as well
		eloModifiers = _calculateEloChange(games[i]);

		console.log('--- ELO CHANGE -------');
		console.log(games[i].awayTeam + ': ' + eloModifiers.away);
		console.log(games[i].homeTeam + ': ' + eloModifiers.home);
		console.log('--------------');

		_eloMap[games[i].homeTeam].elo += eloModifiers.home;
		_eloMap[games[i].homeTeam].change = eloModifiers.home;
		_eloMap[games[i].awayTeam].elo += eloModifiers.away;
		_eloMap[games[i].awayTeam].change = eloModifiers.away;

		// Please associate all these new ELO scores to the week after whatever week is currently in context
		_eloMap[games[i].homeTeam].week += 1;
		_eloMap[games[i].awayTeam].week += 1;

		// Update the win-loss record
		if (scoreDifferential > 0)
		{
			_eloMap[games[i].homeTeam].wins += 1;
			_eloMap[games[i].awayTeam].losses += 1;
		}
		else if (scoreDifferential < 0)
		{
			_eloMap[games[i].homeTeam].losses += 1;
			_eloMap[games[i].awayTeam].wins += 1;
		}
		else
		{
			// Instantiate the draws property if it hasn't been set up yet
			_eloMap[games[i].homeTeam].draws = _eloMap[games[i].homeTeam].draws || 0;
			_eloMap[games[i].awayTeam].draws = _eloMap[games[i].awayTeam].draws || 0;

			_eloMap[games[i].homeTeam].draws += 1;
			_eloMap[games[i].awayTeam].draws += 1;
		}

		// Strip any database metadata from the records
		delete _eloMap[games[i].homeTeam]._id;
		delete _eloMap[games[i].awayTeam]._id;

		// Prep the ELO records for transfer to the database
		databaseElos.push(mongo.formInsertSingleQuery(_eloMap[games[i].homeTeam]));
		databaseElos.push(mongo.formInsertSingleQuery(_eloMap[games[i].awayTeam]));
	}

	// For any teams on bye, update their Elo record to indicate no change in their score for the coming week
	if (games.length < 16)
	{
		teamNames = Object.keys(_eloMap);
		for (let j = 0; j < teamNames.length; j += 1)
		{
			// Assume all records that are not updated belong to teams that were on bye the past week
			if (_eloMap[teamNames[j]].week === week)
			{
				console.log('----------------------------------------');
				console.log(teamNames[j] + ' were on BYE');
				console.log('----------------------------------------');

				_eloMap[teamNames[j]].week += 1;
				_eloMap[teamNames[j]].change = 0;

				delete _eloMap[teamNames[j]]._id;
				databaseElos.push(mongo.formInsertSingleQuery(_eloMap[teamNames[j]]));
			}
		}
	}

	// Remove all the old ELO records from context
	await mongo.bulkWrite(ELO_COLLECTION, true, mongo.formDeleteManyQuery({ week: week + 1}));

	// Push the new proprietary ELO scores into the database
	databaseElos.unshift(ELO_COLLECTION, true);
	await mongo.bulkWrite.apply(mongo, databaseElos);

	// Sort the ELO data by scores in descending order
	eloScores.sort(function(a, b)
	{
		var scoreA = a.elo,
			scoreB = b.elo;

		if (scoreA < scoreB)
		{
			return 1;
		}
		else if (scoreA > scoreB)
		{
			return -1;
		}

		return 0;
	});

	// Write out the data
	_fs.writeFileSync(OUTPUT_FILE + (week + 1) + JSON_EXTENSION, JSON.stringify({ teams : eloScores }));

	// Closing logic
	console.log('Done!');
	process.exit();
}());