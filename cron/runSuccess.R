#!/usr/bin/env Rscript

# Database connection
connection_string = "mongodb+srv://kinsho:AlqxceTFa6zMv640@owlblog.g8jy7tj.mongodb.net/?retryWrites=true&w=majority"
database_name = "nfl2023"

# Imports
library(tidyverse)
library(here)
library(nflfastR)
library(mongolite)
source(here::here('cron/mongoHelperFunctions.R'))
options(scipen = 9999)

# Gather all play data for the current season
nfl_data <- load_pbp(2023) %>%
  mutate(game_ref = paste(away_team, home_team, sep = ' @ '))

# For testing purposes, we can analyze a single game
# nfl_data <- filter(nfl_data, away_team == 'BUF', home_team == 'TEN', season == 2021)

# Pull only run plays
run_plays <- filter(nfl_data, (play_type == 'run' | rush == 1), qb_scramble == 0, play_type != 'no_play') %>%
  mutate(run_id = paste(game_id, play_id, sep = '-'))

# Filter out the run plays into categories based on down
first_down_runs <- filter(run_plays, down == 1)
second_down_runs <- filter(run_plays, down == 2)
third_down_runs <- filter(run_plays, down == 3)
fourth_down_runs <- filter(run_plays, down == 4)

# Determine success metrics
first_down_runs <- mutate(first_down_runs, success_threshold = 0.4, min_yards = 3)
second_down_runs <- mutate(second_down_runs, success_threshold = 0.6, min_yards = 3)
third_down_runs <- mutate(third_down_runs, success_threshold = 1.0, min_yards = 3)
fourth_down_runs <- mutate(fourth_down_runs, success_threshold = 1.0, min_yards = 3)

# Join together all the run plays
run_plays <- first_down_runs %>% 
  rbind(second_down_runs) %>%
  rbind(third_down_runs) %>%
  rbind(fourth_down_runs)

# Assess yards accrued per carry and yards surrendered by carry
ypc_gained <- group_by(run_plays, posteam) %>%
  dplyr::summarize(
    season_total_run_plays = n(),
    total_yards = sum(yards_gained),
    ypc = round((total_yards / season_total_run_plays), 2)
  )
ypc_surrendered <- group_by(run_plays, defteam) %>%
  dplyr::summarize(
    season_total_run_plays = n(),
    total_yards = sum(yards_gained),
    ypc = round((total_yards / season_total_run_plays), 2)
  )

# Now evaluate all the run plays to determine which ones were successful and which ones were abject failures
successful_run_plays <- filter(run_plays, (penalty != 1 | penalty_team != posteam)) %>%
  filter(fumble_forced != 1) %>%
  filter(ydstogo * success_threshold <= yards_gained) %>%
  filter(first_down == 1 | yards_gained >= min_yards)
negative_run_plays <- filter(run_plays, (penalty == 1 & penalty_team == posteam) | yards_gained <= 0 | fumble_forced == 1)
big_run_plays <- filter(run_plays, (penalty != 1 | penalty_team != posteam)) %>%
  filter(fumble_forced != 1) %>%
  filter(yards_gained >= 10 & first_down == 1)
run_plays <- mutate(run_plays, run_successful = ifelse(run_id %in% successful_run_plays$run_id, 1, 0)) %>%
  mutate(run_failure = ifelse(run_id %in% negative_run_plays$run_id, 1, 0)) %>%
  mutate(big_run = ifelse(run_id %in% big_run_plays$run_id, 1, 0))

# Summarize all our league findings here in ratio form
league_offense_run_success <- group_by(run_plays, posteam) %>%
  dplyr::summarize(
    season_total_run_plays = n(),
    season_successful_run_plays = sum(run_successful == 1),
    season_negative_run_plays = sum(run_failure == 1),
    season_big_run_plays = sum(big_run == 1),
    season_run_grade = round((
      (season_successful_run_plays - season_negative_run_plays + (season_big_run_plays / 2)) / season_total_run_plays
    ), 2)
  ) %>%
  inner_join(ypc_gained) %>%
  arrange(posteam)
league_defense_run_success <- group_by(run_plays, defteam) %>%
  dplyr::summarize(
    season_total_run_plays = n(),
    season_successful_run_plays = sum(run_successful == 1),
    season_negative_run_plays = sum(run_failure == 1),
    season_big_run_plays = sum(big_run == 1),
    season_run_grade = round((
      (season_successful_run_plays - season_negative_run_plays + (season_big_run_plays / 2)) / season_total_run_plays
    ), 2)
  ) %>%
  inner_join(ypc_surrendered) %>%
  arrange(defteam)

# Use the standard deviation of the ratio to how much certain teams are excelling or lagging behind
mean_offense_run_success <- mean(league_offense_run_success$season_run_grade)
sd_offense_run_success <- sd(league_offense_run_success$season_run_grade)
mean_defense_run_success <- mean(league_defense_run_success$season_run_grade)
sd_defense_run_success <- sd(league_defense_run_success$season_run_grade)
league_offense_run_success <- mutate(league_offense_run_success, deviation = round(((season_run_grade - mean_offense_run_success) / sd_offense_run_success), 3))
league_defense_run_success <- mutate(league_defense_run_success, deviation = round(((mean_defense_run_success - season_run_grade) / sd_defense_run_success), 3))

# Upload the data to our database
teams_collection = mongo(collection = "teams", db = database_name, url = connection_string)

for (row in 1:nrow(league_offense_run_success)) {
  query <- query_statement(league_offense_run_success[row, 'posteam'])
  
  # Update to account for the total number of runs faced by both the offense and defense
  o_updater <- offense_update_statement('total_runs', league_offense_run_success[row, 'season_total_run_plays'])
  d_updater <- defense_update_statement('total_runs', league_defense_run_success[row, 'season_total_run_plays'])
  teams_collection$update(query, o_updater, upsert = FALSE)
  teams_collection$update(query, d_updater, upsert = FALSE)

  # Update to account for the total number of successful runs experienced by both the offense and defense
  o_updater <- offense_update_statement('successful_runs', league_offense_run_success[row, 'season_successful_run_plays'])
  d_updater <- defense_update_statement('successful_runs', league_defense_run_success[row, 'season_successful_run_plays'])
  teams_collection$update(query, o_updater, upsert = FALSE)
  teams_collection$update(query, d_updater, upsert = FALSE)

  # Update to account for the total number of negative runs experienced by both the offense and defense
  o_updater <- offense_update_statement('negative_runs', league_offense_run_success[row, 'season_negative_run_plays'])
  d_updater <- defense_update_statement('negative_runs', league_defense_run_success[row, 'season_negative_run_plays'])
  teams_collection$update(query, o_updater, upsert = FALSE)
  teams_collection$update(query, d_updater, upsert = FALSE)
  
  # Update to account for the total number of big runs experienced by both the offense and defense
  o_updater <- offense_update_statement('big_runs', league_offense_run_success[row, 'season_big_run_plays'])
  d_updater <- defense_update_statement('big_runs', league_defense_run_success[row, 'season_big_run_plays'])
  teams_collection$update(query, o_updater, upsert = FALSE)
  teams_collection$update(query, d_updater, upsert = FALSE)
  
  # Update to record the overall run grade given to each offense and defensive unit in the NFL
  o_updater <- offense_update_statement('run_grade', league_offense_run_success[row, 'season_run_grade'])
  d_updater <- defense_update_statement('run_grade', league_defense_run_success[row, 'season_run_grade'])
  teams_collection$update(query, o_updater, upsert = FALSE)
  teams_collection$update(query, d_updater, upsert = FALSE)

  # Update to record the measured deviation from the mean run grade for every offense and defensive unit in the NFL
  o_updater <- offense_update_statement('run_grade_sd', league_offense_run_success[row, 'deviation'])
  d_updater <- defense_update_statement('run_grade_sd', league_defense_run_success[row, 'deviation'])
  teams_collection$update(query, o_updater, upsert = FALSE)
  teams_collection$update(query, d_updater, upsert = FALSE)
}

