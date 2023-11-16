import database from '../lib/database.js'
import Team from '../lib/models/teams.js'

import sfData from '../teams/49ers.json' assert {
	type: 'json'
};
import chiData from '../teams/bears.json' assert {
	type: 'json'
};
import cinData from '../teams/bengals.json' assert {
	type: 'json'
};
import bufData from '../teams/bills.json' assert {
	type: 'json'
};
import denData from '../teams/broncos.json' assert {
	type: 'json'
};
import cleData from '../teams/browns.json' assert {
	type: 'json'
};
import tbData from '../teams/buccaneers.json' assert {
	type: 'json'
};
import ariData from '../teams/cardinals.json' assert {
	type: 'json'
};
import lacData from '../teams/chargers.json' assert {
	type: 'json'
};
import indData from '../teams/colts.json' assert {
	type: 'json'
};
import wasData from '../teams/commanders.json' assert {
	type: 'json'
};
import dalData from '../teams/cowboys.json' assert {
	type: 'json'
};
import atlData from '../teams/falcons.json' assert {
	type: 'json'
};
import nygData from '../teams/giants.json' assert {
	type: 'json'
};
import jaxData from '../teams/jaguars.json' assert {
	type: 'json'
};
import nyjData from '../teams/jets.json' assert {
	type: 'json'
};
import detData from '../teams/lions.json' assert {
	type: 'json'
};
import gbData from '../teams/packers.json' assert {
	type: 'json'
};
import carData from '../teams/panthers.json' assert {
	type: 'json'
};
import neData from '../teams/patriots.json' assert {
	type: 'json'
};
import lvData from '../teams/raiders.json' assert {
	type: 'json'
};
import laData from '../teams/rams.json' assert {
	type: 'json'
};
import balData from '../teams/ravens.json' assert {
	type: 'json'
};
import noData from '../teams/saints.json' assert {
	type: 'json'
};
import seaData from '../teams/seahawks.json' assert {
	type: 'json'
};
import pitData from '../teams/steelers.json' assert {
	type: 'json'
};
import minData from '../teams/vikings.json' assert {
	type: 'json'
};

const teamData = {
	SF: sfData,
	CHI: chiData,
	CIN: cinData,
	BUF: bufData,
	DEN: denData,
	CLE: cleData,
	TB: tbData,
	ARI: ariData,
	LAC: lacData,
	IND: indData,
	WAS: wasData,
	DAL: dalData,
	ATL: atlData,
	NYG: nygData,
	JAX: jaxData,
	NYJ: nyjData,
	DET: detData,
	GB: gbData,
	CAR: carData,
	NE: neData,
	LV: lvData,
	LA: laData,
	BAL: balData,
	NO: noData,
	SEA: seaData,
	PIT: pitData,
	MIN: minData
};

await database();

try {
	const teams = Object.keys(teamData);
	for (let i = 0; i < teams.length; i += 1) {
		let res = await Team.replaceOne({ abbrev : teams[i] }, teamData[teams[i]], { upsert : true });
	}
} catch (error) {
	console.error(error);
} finally {
	process.exit();
}
