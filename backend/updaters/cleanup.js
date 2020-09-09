/**
 * @module cleanup
 */

// ----------------- APP_ROOT_PATH INSTANTIATION --------------------------

global.OwlStakes =
{
	require : require('app-root-path').require
};

// ----------------- EXTERNAL MODULES --------------------------

var mongo = global.OwlStakes.require('databaseDriver');

// ----------------- ENUMS/CONSTANTS --------------------------

var ELO_COLLECTION = 'elo',
	GAMES_COLLECTION = 'games';

// ----------------- LOGIC --------------------------

(async function ()
{
	try
	{
		await mongo.initialize();

		// Remove all the ELO records
		await mongo.bulkWrite(ELO_COLLECTION, true, mongo.formDeleteManyQuery({}));

		// Remove all game records older than the 2020 season
		await mongo.bulkWrite(GAMES_COLLECTION, true, mongo.formDeleteManyQuery({ date : { $lt : new Date('01/01/2020') }}));

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