import database from '../lib/database.js'
import Team from '../lib/models/teams.js'
import { writeFileSync } from 'node:fs';

await database();

try {
	const teams = await Team.find({}).lean();
	for (let i = 0; i < teams.length; i += 1) {
		writeFileSync('teams/' + teams[i].name.toLowerCase() + '.json', JSON.stringify(teams[i]));
		console.log(teams[i].name.toLowerCase() + '.json');
	}
} catch (error) {
	console.error(error);
} finally {
	process.exit();
}