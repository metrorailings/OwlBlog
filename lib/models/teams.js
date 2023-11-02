import mongoose from "mongoose";

const TeamSchema = new mongoose.Schema({

	market: String,
	name: String,
	abbrev: String,
	head_coach: String,

	oc: {
		name: String,
		tier: {
			type: String,
			enum: ["blue", "red", "green", "white", ""],
			default: ""
		}
	},

	dc: {
		name: String,
		tier: {
			type: String,
			enum: ["blue", "red", "green", "white", ""],
			default: ""
		}
	},

	quarterback: {
		name: String,
		tier: {
			type: String,
			enum: ["blue", "red", "green", "white", ""],
			default: ""
		}
	},

	offense: {
		epa_per_play: Number,
		epa_per_play_sd: Number,

		total_runs: Number,
		successful_runs: Number,
		rsr: Number,
		rsr_sd: Number,

		total_series: Number,
		neg_game_script_situations: Number,
		neg_game_script_situations_overcome: Number,
		ngssr: Number,
		ngssr_sd: Number,

		red_zone_trips: Number,
		red_zone_touchdowns: Number,
		red_zone_field_goals: Number,
		red_zone_failures: Number,
		rz_mean_points: Number,
		rz_sd: Number,

		key_vectors: [String]
	},

	defense: {
		epa_per_play: Number,
		epa_per_play_sd: Number,

		total_runs: Number,
		successful_runs: Number,
		rsr: Number,
		rsr_sd: Number,

		total_series: Number,
		neg_game_script_situations: Number,
		neg_game_script_situations_overcome: Number,
		ngssr: Number,
		ngssr_sd: Number,

		red_zone_trips: Number,
		red_zone_touchdowns: Number,
		red_zone_field_goals: Number,
		red_zone_failures: Number,
		rz_mean_points: Number,

		key_linemen: [String],
		key_back_seven_players: [String]
	},

	key_players_injured_reserved: [String],
	comebacks_staged: Number,
	comebacks_surrendered: Number,
	emotional_edge: Boolean,
	in_turmoil: Boolean
}, { collection: 'teams' })

module.exports = (mongoose.models?.Team || mongoose.model("Team", TeamSchema));