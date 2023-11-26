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
# Tag all plays and series with IDs
nfl_data <- load_pbp(2023) %>%
  mutate(game_ref = paste(away_team, home_team, sep = ' @ ')) %>%
  mutate(play_id = paste(game_id, play_id, sep = '---')) %>%
  mutate(series_id = paste(game_id, series, sep = '---'))

# For testing purposes, we can analyze a single game
# nfl_data <- filter(nfl_data, away_team == 'BUF', home_team == 'TEN', season == 2021)

# Filter out the plays into categories based on down
first_down_plays <- filter(nfl_data, down == 1)
second_down_plays <- filter(nfl_data, down == 2)
third_down_plays <- filter(nfl_data, down == 3)
fourth_down_plays <- filter(nfl_data, down == 4)

# Determine tests that figure out if an offense is facing negative game script
first_down_plays <- mutate(first_down_plays, ngs_test = 11)
second_down_plays <- mutate(second_down_plays, ngs_test = 10)
third_down_plays <- mutate(third_down_plays, ngs_test = 8)
fourth_down_plays <- mutate(fourth_down_plays, ngs_test = 1) %>%
  filter(punt_attempt != 1 | punt_blocked == 1)

# Join together all the plays and remove all irrelevant data
all_plays <- rbind(first_down_plays, second_down_plays) %>%
  rbind(third_down_plays) %>%
  rbind(fourth_down_plays) %>%
  filter(series_result != "QB kneel") %>%
  filter(series_result != "End of half") %>%
  filter(play_type != "")

# Now evaluate all the series to determine which ones involved negative game script
# Also massage the data for summarizing
# All series that end in field goals count as halfway successful
ngs_plays <- filter(all_plays, ydstogo >= ngs_test) %>%
  distinct(series_id, .keep_all = TRUE) %>%
  mutate(series_success = ifelse(series_result == "Field goal", 0.5, series_success))

# Calculate how many series of downs offenses and defenses have experienced this year
total_series_by_offense <- distinct(all_plays, series_id, .keep_all = TRUE) %>%
  group_by(posteam) %>%
  summarize(total_series = n()) %>%
  arrange(desc(total_series))
total_series_by_defense <- distinct(all_plays, series_id, .keep_all = TRUE) %>%
  group_by(defteam) %>%
  summarize(total_series = n()) %>%
  arrange(total_series)

# Summarize all our league findings here in ratio form
league_offense_ngs_success <- group_by(ngs_plays, posteam) %>%
  dplyr::summarize(
    neg_game_script_situations = n(),
    neg_game_script_situations_overcome = sum(series_success),
  ) %>%
  inner_join(total_series_by_offense, by = "posteam") %>%
  mutate(ngssr = round(((neg_game_script_situations - (0.6 * neg_game_script_situations_overcome)) / total_series), 2)) %>%
  arrange(posteam)
league_defense_ngs_success <- group_by(ngs_plays, defteam) %>%
  dplyr::summarize(
    neg_game_script_situations = n(),
    neg_game_script_situations_surrendered = sum(series_success),
  ) %>%
  inner_join(total_series_by_defense, by = "defteam") %>%
  mutate(ngssr = round(((neg_game_script_situations - (0.6 * neg_game_script_situations_surrendered)) / total_series), 2)) %>%
  arrange(defteam)

# Use the standard deviation of the ratio to how much certain teams are excelling or lagging behind
mean_offense_ngs_success <- mean(league_offense_ngs_success$ngssr)
sd_offense_ngs_success <- sd(league_offense_ngs_success$ngssr)
mean_defense_ngs_success <- mean(league_defense_ngs_success$ngssr)
sd_defense_ngs_success <- sd(league_defense_ngs_success$ngssr)
league_offense_ngs_success <- mutate(league_offense_ngs_success, deviation = round(((mean_offense_ngs_success - ngssr) / sd_offense_ngs_success), 3))
league_defense_ngs_success <- mutate(league_defense_ngs_success, deviation = round(((ngssr - mean_defense_ngs_success) / sd_defense_ngs_success), 3))

# Upload the data to our database
teams_collection = mongo(collection = "teams", db = database_name, url = connection_string)

for (row in 1:nrow(league_offense_ngs_success)) {
  query <- query_statement(league_offense_ngs_success[row, 'posteam'])
  
  # Update the total number of meaningful series of plays faced by both offenses and defenses this season
  o_updater <- offense_update_statement('total_series', league_offense_ngs_success[row, 'total_series'])
  d_updater <- defense_update_statement('total_series', league_defense_ngs_success[row, 'total_series'])
  teams_collection$update(query, o_updater, upsert = FALSE)
  teams_collection$update(query, d_updater, upsert = FALSE)

  # Update the total number of negative game script situations faced by both offenses and defenses this season
  o_updater <- offense_update_statement('neg_game_script_situations', league_offense_ngs_success[row, 'neg_game_script_situations'])
  d_updater <- defense_update_statement('neg_game_script_situations', league_defense_ngs_success[row, 'neg_game_script_situations'])
  teams_collection$update(query, o_updater, upsert = FALSE)
  teams_collection$update(query, d_updater, upsert = FALSE)

  # Update the total number of negative game script situations either overcome by offenses or surrendered by defenses this season
  o_updater <- offense_update_statement('neg_game_script_situations_overcome', league_offense_ngs_success[row, 'neg_game_script_situations_overcome'])
  d_updater <- defense_update_statement('neg_game_script_situations_surrendered', league_defense_ngs_success[row, 'neg_game_script_situations_surrendered'])
  teams_collection$update(query, o_updater, upsert = FALSE)
  teams_collection$update(query, d_updater, upsert = FALSE)

  # Notate the negative game script score given to all offenses and defenses
  o_updater <- offense_update_statement('ngssr', league_offense_ngs_success[row, 'ngssr'])
  d_updater <- defense_update_statement('ngssr', league_defense_ngs_success[row, 'ngssr'])
  teams_collection$update(query, o_updater, upsert = FALSE)
  teams_collection$update(query, d_updater, upsert = FALSE)

  # Also notate the deviation from the mean score for all offenses and defenses
  o_updater <- offense_update_statement('ngssr_sd', league_offense_ngs_success[row, 'deviation'])
  d_updater <- defense_update_statement('ngssr_sd', league_defense_ngs_success[row, 'deviation'])
  teams_collection$update(query, o_updater, upsert = FALSE)
  teams_collection$update(query, d_updater, upsert = FALSE)
}