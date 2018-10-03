/**
 * @module weekDownload
 */

// ----------------- APP_ROOT_PATH INSTANTIATION --------------------------

global.OwlStakes =
{
	require : require('app-root-path').require
};

// ----------------- EXTERNAL MODULES --------------------------

var _fs = require('fs'),

	mongo = global.OwlStakes.require('databaseDriver');

// ----------------- ENUMS/CONSTANTS --------------------------

var GAMES_COLLECTION = 'games',

	OUTPUT_FILE = 'backend/data/week',
	JSON_EXTENSION = '.json';

// ----------------- LOGIC --------------------------

(async function ()
{
	await mongo.initialize();

	// Find the week that we need to fetch the game data from
	var week = parseInt(process.argv[2]);

	// Note the week
	console.log('WEEK ---> ' + week);

	// For ineligible weeks, bail out of the program
	if (!week)
	{
		console.error('Pass in a legit week.');
		process.exit();
	}

	// Now retrieve that data
	var dbResults = await mongo.read(GAMES_COLLECTION,
	{
		week: week
	});

	// Format the data so that we can load sportsbook spreads and curves into each game
	for (let i = 0; i < dbResults.length; i += 1)
	{
		dbResults[i].bookSpread = dbResults[i].bookSpread || 0;
		dbResults[i].curve = dbResults[i].curve || 0;
		dbResults[i].owlSpread = dbResults[i].owlSpread || 0;
		dbResults[i].pickHomeTeam = dbResults[i].pickHomeTeam || false;
		dbResults[i].pickAwayTeam = dbResults[i].pickAwayTeam || false;
		dbResults[i].awayTeamScore = dbResults[i].awayTeamScore || '';
		dbResults[i].homeTeamScore = dbResults[i].homeTeamScore || '';
	}

	// Write out the data
	_fs.writeFileSync(OUTPUT_FILE + week + JSON_EXTENSION, JSON.stringify({ games : dbResults }));

	console.log(dbResults);

	// Closing logic
	console.log('Done!');
	process.exit();
}());