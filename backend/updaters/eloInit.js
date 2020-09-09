/**
 * @module eloInit
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

	INPUT_FILE = 'backend/data/elo1.json',
	OUTPUT_FILE = 'data/elo/',
	JSON_EXTENSION = '.json';

// ----------------- LOGIC --------------------------

(async function ()
{
	try
	{
		var rawData,
			eloScores = [], databaseElos = [];

		await mongo.initialize();

		// Retrieve the data
		rawData = _fs.readFileSync(INPUT_FILE, 'utf8');

		// Parse the JSON data
		rawData = JSON.parse(rawData);

		for (let i = 0; i < rawData.teams.length; i += 1)
		{
			eloScores.push(
			{
				name: rawData.teams[i].name,
				elo: rawData.teams[i].elo,
				change: 0,
				wins: 0,
				losses: 0,
				week: 1
			});

			databaseElos.push(mongo.formInsertSingleQuery(eloScores.slice(-1).pop()));
		}

		console.log('Pushing new game data into the database...');

		// Remove all the old initial ELO records from context
		await mongo.bulkWrite(ELO_COLLECTION, true, mongo.formDeleteManyQuery({ week: 1 }));

		// Push the preseason ELO scores into the database
		databaseElos.unshift(ELO_COLLECTION, true);
		await mongo.bulkWrite.apply(mongo, databaseElos);

		// Sort the ELO scores from highest to lowest
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

		// Write out the data to the front-facing data file as well
		_fs.writeFileSync(OUTPUT_FILE + 1 + JSON_EXTENSION, JSON.stringify({ teams : eloScores }));

		// Closing logic
		console.log('Done!');
		process.exit();
	}
	catch(error)
	{
		console.log('ERROR');
		console.error(error);
		process.exit();
	}
}());