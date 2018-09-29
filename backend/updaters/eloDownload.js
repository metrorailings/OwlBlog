/**
 * @module eloDownload
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

var ELO_COLLECTION = 'elo',

	OUTPUT_FILE = 'data/elo',
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
	var dbResults = await mongo.read(ELO_COLLECTION,
	{
		week: week
	});

	// Format the data so that we can manually update ELO scores for any one team
	for (let i = 0; i < dbResults.length; i += 1)
	{
		dbResults[i].change = dbResults[i].change|| 0;
		dbResults[i].wins = dbResults[i].wins || 0;
		dbResults[i].losses = dbResults[i].losses || 0;
		dbResults[i].week = week;
	}

	// Write out the data
	_fs.writeFileSync(OUTPUT_FILE + week + JSON_EXTENSION, JSON.stringify({ teams : dbResults }));

	console.log(dbResults);

	// Closing logic
	console.log('Done!');
	process.exit();
}());