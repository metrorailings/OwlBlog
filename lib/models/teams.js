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
		trailing_epa_per_play: Number,
		trailing_epa_per_play_sd: Number,

		total_runs: Number,
		successful_runs: Number,
		negative_runs: Number,
		big_runs: Number,
		run_grade: Number,
		run_grade_sd: Number,

		total_series: Number,
		neg_game_script_situations: Number,
		neg_game_script_situations_overcome: Number,
		ngssr: Number,
		ngssr_sd: Number,

		fumbles: Number,
		interceptions: Number,
		fourth_down_failures: Number,
		two_point_play_failures: Number,

		key_vectors: [String]
	},

	defense: {
		trailing_epa_per_play: Number,
		trailing_epa_per_play_sd: Number,

		total_runs: Number,
		successful_runs: Number,
		negative_runs: Number,
		big_runs: Number,
		run_grade: Number,
		run_grade_sd: Number,

		total_series: Number,
		neg_game_script_situations: Number,
		neg_game_script_situations_surrendered: Number,
		ngssr: Number,
		ngssr_sd: Number,

		key_linemen: [String],
		key_back_seven_players: [String]
	},

	special_teams: {
		fg_missed: Number,
		xp_missed: Number
	},

	team: {
		comebacks_staged: Number,
		comebacks_surrendered: Number,

		total_plays: Number,
		penalties: Number,
	},

	key_players_injured_reserved: [String],
	emotional_edge: Boolean,
	in_turmoil: Boolean
}, { collection: 'teams' })

export default mongoose.model("Team", TeamSchema);