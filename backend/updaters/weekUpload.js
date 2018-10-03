/**
 * @module weekUpload
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

	INPUT_FILE = 'backend/data/week',
	JSON_EXTENSION = '.json';

// ----------------- LOGIC --------------------------

(async function ()
{
	var rawData,
		processedData = [],
		week;

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

	// Now retrieve the file data
	rawData = _fs.readFileSync(INPUT_FILE + week + JSON_EXTENSION);

	// Parse the JSON data
	rawData = JSON.parse(rawData);
	rawData = rawData.games;

	// Prep the data so that we can save it into the games table
	for (let i = 0; i < rawData.length; i += 1)
	{
		// Reformat the date to ensure that it's a proper Date object
		rawData[i].date = new Date(rawData[i].date);

		processedData.push(mongo.formUpdateOneQuery(
		{
			_id: rawData[i]._id
		}, rawData[i]));
	}

	// Push the data into the database
	processedData.unshift(GAMES_COLLECTION, true);
	await mongo.bulkWrite.apply(mongo, processedData);

	// Closing logic
	console.log('Done!');
	process.exit();
}());