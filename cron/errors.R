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
standing_plays <- filter(nfl_data, is.na(play_type) == FALSE)

# Gather all plays where errors were committed, be they penalties, fumbles, interceptions,
# failed field goals, failed two-point plays, or failed extra points
penalty_plays <- filter(nfl_data, penalty == 1) %>%
  group_by(penalty_team) %>%
  summarize(total_penalties = n()) %>%
  arrange(penalty_team)

fumble_plays <- filter(standing_plays, fumble == 1) %>%
  group_by(posteam) %>%
  summarize(fumbles = n()) %>%
  arrange(posteam)

interception_plays <- filter(standing_plays, interception == 1) %>%
  group_by(posteam) %>%
  summarize(interceptions = n()) %>%
  arrange(posteam)

# Only count field goal attempts less than 60 yards from the uprights
failed_fg_plays <- filter(standing_plays, field_goal_attempt == 1 & field_goal_result != 'made' & yardline_100 <= 43) %>%
  group_by(posteam) %>%
  summarize(missed_field_goals = n()) %>%
  arrange(posteam)

failed_xp_plays <- filter(standing_plays, extra_point_attempt == 1 & extra_point_result != 'good') %>%
  group_by(posteam) %>%
  summarize(missed_extra_points = n()) %>%
  arrange(posteam)

failed_two_point_plays <- filter(standing_plays, two_point_attempt == 1 & two_point_conv_result != 'success') %>%
  group_by(posteam) %>%
  summarize(missed_two_point_plays = n()) %>%
  arrange(posteam)

fourth_down_failures <- filter(standing_plays, down == 4, field_goal_attempt == 0 & punt_attempt == 0 & qb_kneel == 0 & fourth_down_converted == FALSE) %>%
  group_by(posteam) %>%
  summarize(fourth_down_failures = n()) %>%
  arrange(posteam)

names(penalty_plays)[names(penalty_plays) == 'penalty_team'] <- 'team'
names(fumble_plays)[names(fumble_plays) == 'posteam'] <- 'team'
names(interception_plays)[names(interception_plays) == 'posteam'] <- 'team'
names(failed_fg_plays)[names(failed_fg_plays) == 'posteam'] <- 'team'
names(failed_xp_plays)[names(failed_xp_plays) == 'posteam'] <- 'team'
names(failed_two_point_plays)[names(failed_two_point_plays) == 'posteam'] <- 'team'
names(fourth_down_failures)[names(fourth_down_failures) == 'posteam'] <- 'team'

error_plays <- full_join(penalty_plays, fumble_plays) %>%
  full_join(interception_plays) %>%
  full_join(failed_fg_plays) %>%
  full_join(failed_xp_plays) %>%
  full_join(failed_two_point_plays) %>%
  full_join(fourth_down_failures)
error_plays <- replace_na(error_plays, list(total_penalties = 0, fumbles = 0,
                                            interceptions = 0, 
                                            missed_field_goals = 0,
                                            missed_extra_points = 0,
                                            missed_two_point_plays = 0,
                                            fourth_down_failures = 0))

# Test data
# test_data <- filter(standing_plays, two_point_attempt == 1 & two_point_conv_result != 'success') %>%
#  filter(posteam == 'ARI') %>%
#  select(week, desc)

# Figure out the proper number of plays to analyze here
total_plays <- filter(nfl_data, is.na(play_type) == FALSE) %>%
  filter(play_type != 'qb_kneel') %>%
  filter(play_type != 'qb_spike') %>%
  filter(timeout == 0)

# Find out exactly how many meaningful plays each team played so far this year
total_plays_by_offense <- group_by(total_plays, posteam) %>%
  summarize(
    total_plays_on_offense = n()
  )
total_plays_by_defense <- group_by(total_plays, defteam) %>%
  summarize(
    total_plays_on_defense = n()
  )
total_plays_by_team = inner_join(total_plays_by_offense, total_plays_by_defense, by = join_by(posteam == defteam)) %>%
  mutate(total_plays = total_plays_on_offense + total_plays_on_defense) %>%
  arrange(posteam)
names(total_plays_by_team)[names(total_plays_by_team) == 'posteam'] <- 'team'

# Upload the data to our database
teams_collection = mongo(collection = "teams", db = database_name, url = connection_string)

for (row in 1:nrow(total_plays_by_team)) {
  query <- query_statement(total_plays_by_team[row, 'team'])
  
  # Account for the total number of relevant plays each club in the league has so far run this year
  t_updater <- team_update_statement('total_plays', total_plays_by_team[row, 'total_plays'])
  teams_collection$update(query, t_updater, upsert = FALSE)

  # Record the total number of penalties each team has accrued
  t_updater <- team_update_statement('penalties', error_plays[row, 'total_penalties'])
  teams_collection$update(query, t_updater, upsert = FALSE)

  # Record all field goals and extra points missed
  s_updater <- special_teams_update_statement('fg_missed', error_plays[row, 'missed_field_goals'])
  teams_collection$update(query, s_updater, upsert = FALSE)
  s_updater <- special_teams_update_statement('xp_missed', error_plays[row, 'missed_extra_points'])
  teams_collection$update(query, s_updater, upsert = FALSE)

  # Record all the times the offense has lost the ball
  o_updater <- offense_update_statement('fumbles', error_plays[row, 'fumbles'])
  teams_collection$update(query, o_updater, upsert = FALSE)
  o_updater <- offense_update_statement('interceptions', error_plays[row, 'interceptions'])
  teams_collection$update(query, o_updater, upsert = FALSE)

  # Record the number of times the offense failed to convert on fourth down or failed to complete a two-point attempt
  o_updater <- offense_update_statement('fourth_down_failures', error_plays[row, 'fourth_down_failures'])
  teams_collection$update(query, o_updater, upsert = FALSE)
  o_updater <- offense_update_statement('two_point_play_failures', error_plays[row, 'missed_two_point_plays'])
  teams_collection$update(query, o_updater, upsert = FALSE)
}