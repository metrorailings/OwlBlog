/**
 * @module databaseDriver
 */

// ----------------- EXTERNAL MODULES --------------------------

var _Q = require('q'),
	_mongodb = require('mongodb'),

	config = global.OwlStakes.require('config');

// ----------------- ENUMS/CONSTANTS --------------------------

var INSERT_ONE = 'insertOne',
	UPDATE_ONE = 'updateOne',
	UPDATE_MANY = 'updateMany',
	DELETE_ONE = 'deleteOne',
	DELETE_MANY = 'deleteMany';

// ----------------- PRIVATE VARIABLES --------------------------

var client = _mongodb.MongoClient, // The client that will be used to instantiate our connection to the database
	db, // The actual connection which we can use to perform CRUD operations on data

	connect; // The transformed version of the function that will be used to connect to the database

// ----------------- I/O FUNCTION TRANSFORMATIONS --------------------------

connect = _Q.denodeify(client.connect);

// ----------------- MODULE DEFINITION --------------------------

module.exports =
{
	/**
	 * Function responsible for initializing a connection to the database.
	 *
	 * @author kinsho
	 */
	initialize: async function ()
	{
		console.log('Connecting to the database using the following URL: ' + config.DATABASE_URL);

		if ( !(db) )
		{
			try
			{
				// Initialize the MongoDB client
				var clientConnection = await connect(config.DATABASE_URL, { useNewUrlParser: true });
				db = clientConnection.db(config.DATABASE_NAME);
				console.log('Connected to Mongo!');
			}
			catch(error)
			{
				console.error('ERROR ---> databaseDriver.initialize');
				console.error(error);
				throw(error);
			}
		}
	},

	/**
	 * Function responsible for reading data from the database.
	 *
	 * @param {String} collectionName - the name of the collection from which to read data
	 * @param {Object} [params] - the parameters that will be used to filter the data
	 * @param {Object} [sortCriteria] - the instructions that will be used to sort the result set
	 * @param {Object} [aggregationOptions] - the options which to use to preprocess whatever data is returned
	 *
	 * @returns {Array<Object>} - the set of processed records which satisfy the query
	 *
	 * @author kinsho
	 */
	read: function(collectionName, params, sortCriteria, aggregationOptions)
	{
		var collection,
			completeQuery = [],
			keys,
			deferred = _Q.defer(),
			i;

		params = params || {};
		aggregationOptions = aggregationOptions || {};
		sortCriteria = sortCriteria || {};

		// Join both the search terms and the processing options into one object that can be consumed by the Mongo
		// driver
		keys = Object.keys(aggregationOptions);
		if (keys.length)
		{
			for (i = keys.length; i >= 0; i--)
			{
				completeQuery.push(aggregationOptions[keys[i]]);
			}
			completeQuery.unshift({ $match: params });
		}

		// Note that yielding will not be used here, given that the function that necessitates the need for
		// generator stoppage in the first place is a function that is dynamically created at run-time. A clean
		// transformation into a generator-friendly function is not possible, unfortunately
		try
		{
			// Connect to the database and fetch the results
			collection = db.collection(collectionName);

			// Log the query about to be executed
			console.log('About to scoop up records from ' + collectionName);

			if (keys.length)
			{
				collection.aggregate(completeQuery).sort(sortCriteria).toArray(function(err, results)
				{
					if (err)
					{
						throw(err);
					}

					console.log('Just read ' + results.length + ' records from the ' + collectionName + ' collection');
					deferred.resolve(results);
				});
			}
			else
			{
				collection.find(params).sort(sortCriteria).toArray(function(err, results)
				{
					if (err)
					{
						throw(err);
					}

					console.log('Just read ' + results.length + ' records from the ' + collectionName + ' collection');
					deferred.resolve(results);
				});
			}
		}
		catch(error)
		{
			console.error('ERROR ---> databaseDriver.read');
			throw(error);
		}

		return deferred.promise;
	},

		/**
		 * Function responsible for reading and then modifying data within a database from the same transaction.
		 *
		 * @param {String} collectionName - the name of the collection from which to read data
		 * @param {Object} updateInstructions - the instructions that will be used to update the data after the read is made
		 * @param {Object} [params] - the parameters that will be used to filter the data
		 * @param {Object} [sortCriteria] - the instructions that will be used to sort the result set
		 *
		 * @returns {Array<Object>} - the set of processed records which satisfy the query
		 *
		 * @author kinsho
		 */
		readThenModify: function(collectionName, updateInstructions, params, sortCriteria)
		{
			var collection,
				deferred = _Q.defer();

			params = params || {};
			sortCriteria = sortCriteria || {};

			// Note that yielding will not be used here, given that the function that necessitates the need for
			// generator stoppage in the first place is a function that is dynamically created at run-time. A clean
			// transformation into a generator-friendly function is not possible, unfortunately
			try
			{
				// Connect to the database and fetch the results
				collection = db.collection(collectionName);

				// Log the query about to be executed
				console.log('About to do a simultaneous read and update on records from ' + collectionName);
				collection.findAndModify(params, sortCriteria, updateInstructions).then(function(results)
				{
					if ( !(results.ok) )
					{
						deferred.reject();
					}

					console.log('Just performed a simultaneous read and update on at least one record in the ' + collectionName + ' collection');
					deferred.resolve(results.value);
				});
			}
			catch(error)
			{
				console.error('ERROR ---> databaseDriver.readThenModify');
				throw(error);
			}

			return deferred.promise;
		},

		/**
		 * Function responsible for sending over a bunch of write transactions to execute at once.
		 *
		 * @param {String} collectionName - the name of the collection which will be modified in some form
		 * @param {boolean} ordered - a flag to indicate whether the transactions should be executed in the order
		 * 	they are specified
		 * @param {Object} data... - the transactions to wire over to the database
		 *
		 * @author kinsho
		 */
		bulkWrite : function (collectionName, ordered, data)
		{
			var collection,
				dataArgs = [],
				i,
				deferred = _Q.defer();

			// The below statement is simply a means of keeping JSHint from bitching about the data parameter not
			// being explicitly referenced anywhere
			if (!data)
			{
				return null;
			}

			// Note that yielding will not be used here, given that the function that necessitates the need for
			// generator stoppage in the first place is a function that is dynamically created at run-time. A clean
			// transformation into a generator-friendly function is not possible, unfortunately
			try
			{
				// Connect to the database and fetch the results
				collection = db.collection(collectionName);

				// Prep the data that will be written to the database
				for (i = 2; i < arguments.length; i++)
				{
					dataArgs.push(arguments[i]);
				}

				collection.bulkWrite(dataArgs, { ordered: ordered }, function(err, results)
				{
					if (err)
					{
						throw(err);
					}

					console.log('Just did a bulkWrite to the database!');
					if (results.insertedCount)
					{
						console.log('Wrote ' + results.insertedCount + ' records to the "' + collectionName + '" collection');
					}
					if (results.deletedCount)
					{
						console.log('Deleted ' + results.deletedCount + ' records from the "' + collectionName + '" collection');
					}
					if (results.modifiedCount)
					{
						console.log('Modified ' + results.modifiedCount + ' records within the "' + collectionName + '" collection');
					}

					deferred.resolve(results);
				});
			}
			catch(error)
			{
				console.error('ERROR ---> databaseDriver.bulkWrite');
				throw(error);
			}

			return deferred.promise;
		},

		/**
		 * Delete all records from a given collection
		 *
		 * @param {String} collectionName - the name of the collection from which to wipe all data
		 *
		 * @author kinsho
		 */
		deleteAllRecordsFromCollection: async function (collectionName)
		{
			await this.bulkWrite(collectionName, true, this.formDeleteManyQuery({}));
		},

		/**
		 * Function responsible for forming a query to insert a single document into the database via bulkWrite
		 *
		 * @param {Object} data - the data to insert into the database
		 *
		 * @return {Object} - the query that will eventually join a larger set of queries to be consumed by bulkWrite
		 *
		 * @author kinsho
		 */
		formInsertSingleQuery: function(data)
		{
			var result = {};

			result[INSERT_ONE] = { document: data };

			return result;
		},

		/**
		 * Function responsible for forming a query to update a single document within the database via bulkWrite
		 *
		 * @param {Object} filter - the record to target for modification
		 * @param {Object} data - the data to reset into the targeted record
		 * @param {boolean} allowUpsert - a flag indicating whether insertions are allowed should a record not be
		 * 		found that matches the passed filter
		 * @param {Object} unsetData - the data to remove from the targeted record
		 *
		 * @return {Object} - the query that will eventually join a larger set of queries to be consumed by bulkWrite
		 *
		 * @author kinsho
		 */
		formUpdateOneQuery: function(filter, data, allowUpsert, unsetData)
		{
			var result = {};

			result[UPDATE_ONE] =
			{
				filter: filter,
				update:
				{
					$set: data,
				},
				upsert: allowUpsert
			};

			// If data is to be removed from the records, then set up the appropriate unset query
			if (unsetData)
			{
				result[UPDATE_ONE].update.$unset = unsetData;
			}

			return result;
		},

		/**
		 * Function responsible for forming a query to update multiple documents within the database via bulkWrite
		 *
		 * @param {Object} filter - the records to target for modification
		 * @param {Object} data - the data to reset into each matching record
		 * @param {boolean} allowUpsert - a flag indicating whether insertions are allowed should a single record not be
		 * 		found that matches the passed filter
		 *
		 * @return {Object} - the query that will eventually join a larger set of queries to be consumed by bulkWrite
		 *
		 * @author kinsho
		 */
		formUpdateManyQuery: function(filter, data, allowUpsert)
		{
			var result = {};

			result[UPDATE_MANY] =
				{
					filter: filter,
					update:
						{
							$set: data
						},
					upsert: allowUpsert
				};

			return result;
		},

		/**
		 * Function responsible for forming a query to remove a single document from the database via bulkWrite
		 *
		 * @param {Object} filter - the record to target for deletion
		 *
		 * @return {Object} - the query that will eventually join a larger set of queries to be consumed by bulkWrite
		 *
		 * @author kinsho
		 */
		formDeleteOneQuery: function(filter)
		{
			var result = {};

			result[DELETE_ONE] =
				{
					filter: filter
				};

			return result;
		},

		/**
		 * Function responsible for forming a query to remove multiple documents from the database via bulkWrite
		 *
		 * @param {Object} filter - the records to target for deletion
		 *
		 * @return {Object} - the query that will eventually join a larger set of queries to be consumed by bulkWrite
		 *
		 * @author kinsho
		 */
		formDeleteManyQuery: function(filter)
		{
			var result = {};

			result[DELETE_MANY] =
			{
				filter: filter
			};

			return result;
		},

		/**
		 * Function responsible for forming a query to search for all values greater than or equal to the passed value
		 *
		 * @param {any} value - the value that will be the base for the comparison
		 *
		 * @return {Object} - the query that will eventually join a larger query that will be consumed by the read function
		 *
		 * @author kinsho
		 */
		greaterThanOrEqualToOperator: function(value)
		{
			return {
				$gt: value
			};
		}
	};