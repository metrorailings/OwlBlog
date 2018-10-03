/**
 * @module schedule
 */

// ----------------- APP_ROOT_PATH INSTANTIATION --------------------------

global.OwlStakes =
{
	require : require('app-root-path').require
};

// ----------------- EXTERNAL MODULES --------------------------

var fs = require('fs'),
	mongo = global.OwlStakes.require('databaseDriver');

// ----------------- ENUMS/CONSTANTS --------------------------

var DATA_FILE = 'schedule.json',

	GAMES_COLLECTION = 'games',

	TEAM_NAMES =
	{
		IND: 'Colts',
		CIN: 'Bengals',
		NO: 'Saints',
		TB: 'Buccaneers',
		MIA: 'Dolphins',
		TEN: 'Titans',
		OAK: 'Raiders',
		LA: 'Rams',
		ARI: 'Cardinals',
		WAS: 'Redskins',
		MIN: 'Vikings',
		SF: '49ers',
		DEN: 'Broncos',
		SEA: 'Seahawks',
		NYG: 'Giants',
		JAC: 'Jaguars',
		GB: 'Packers',
		CHI: 'Bears',
		DET: 'Lions',
		NYJ: 'Jets',
		LAC: 'Chargers',
		KC: 'Chiefs',
		PHI: 'Eagles',
		ATL: 'Falcons',
		BAL: 'Ravens',
		BUF: 'Bills',
		CAR: 'Panthers',
		DAL: 'Cowboys',
		NE: 'Patriots',
		HOU: 'Texans',
		CLE: 'Browns',
		PIT: 'Steelers'
	};

// ----------------- LOGIC --------------------------

(async function ()
{
	var timezoneOffset = new Date().getTimezoneOffset() * 60000,
		rawData, weekData, gameData,
		weekIndex, gameIndex,
		scheduleData = [],
		gameId = 0;

	await mongo.initialize();

	// Retrieve the data
	rawData = fs.readFileSync(DATA_FILE);

	// Parse the JSON data
	rawData = JSON.parse(rawData);

	for (weekIndex = 0; weekIndex < rawData.weeks.length; weekIndex += 1)
	{
		weekData = rawData.weeks[weekIndex];

		for (gameIndex = 0; gameIndex < weekData.games.length; gameIndex += 1)
		{
			gameData = weekData.games[gameIndex];

			scheduleData.push(mongo.formInsertSingleQuery(
			{
				_id: ++gameId,
				date: new Date(new Date(gameData.scheduled).getTime() - timezoneOffset),
				homeTeam: TEAM_NAMES[gameData.home.alias],
				awayTeam: TEAM_NAMES[gameData.away.alias],
				week: weekIndex + 1
			}));
		}
	}

	console.log('Pushing new game data into the database...');

	scheduleData.unshift(GAMES_COLLECTION, true);
	await mongo.bulkWrite.apply(mongo, scheduleData);

	// Closing logic
	console.log('Done!');
	process.exit();
}());