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

var DATA_FILE = 'data/schedule.json',

	GAMES_COLLECTION = 'games',

	TEAM_NAMES =
	[
		'Colts',
		'Bengals',
		'Saints',
		'Buccaneers',
		'Dolphins',
		'Titans',
		'Raiders',
		'Rams',
		'Cardinals',
		'Football Team',
		'Vikings',
		'49ers',
		'Broncos',
		'Seahawks',
		'Giants',
		'Jaguars',
		'Packers',
		'Bears',
		'Lions',
		'Jets',
		'Chargers',
		'Chiefs',
		'Eagles',
		'Falcons',
		'Ravens',
		'Bills',
		'Panthers',
		'Cowboys',
		'Patriots',
		'Texans',
		'Browns',
		'Steelers'
	];

// ----------------- LOGIC --------------------------

(async function ()
{
	let tzOffset = 300 * 60000,
		rawData, gameData,
		scheduleData = [],
		gameId = 257;

	await mongo.initialize();

	// Retrieve the data
	rawData = fs.readFileSync(DATA_FILE);

	// Parse the JSON data
	rawData = JSON.parse(rawData);

	for (let i = 0; i < rawData.length; i += 1)
	{
		gameData = rawData[i];

		for (let j = 0; j < TEAM_NAMES.length; j += 1)
		{
			if (gameData.home.endsWith(TEAM_NAMES[j]))
			{
				gameData.homeTeam = TEAM_NAMES[j];
			}
			else if (gameData.visitor.endsWith(TEAM_NAMES[j]))
			{
				gameData.awayTeam = TEAM_NAMES[j];
			}
		}

		scheduleData.push(mongo.formUpdateOneQuery({ _id : gameId + 1 },
		{
			_id: ++gameId,
			date: new Date(new Date(gameData.date + ', ' + (gameData.date.split[0] !== 'January' ? 2020 : 2021) + ' ' + gameData.time) - tzOffset),
			homeTeam: gameData.homeTeam,
			awayTeam: gameData.awayTeam,
			week: gameData.week
		}, true));
	}

	console.log('Pushing new game data into the database...');

	scheduleData.unshift(GAMES_COLLECTION, true);
	await mongo.bulkWrite.apply(mongo, scheduleData);

	// Closing logic
	console.log('Done!');
	process.exit();
}());