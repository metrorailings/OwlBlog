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

nfl_data <- load_pbp(2023) %>%
  mutate(game_ref = str_c(away_team, ' @ ', home_team))

# Collect a list of all teams
team_list <- distinct(nfl_data, posteam) %>%
  filter(is.na(posteam) == FALSE)
names(team_list)[names(team_list) == 'posteam'] <- 'team'

## Assess the plays from those games to find those games in which the coach's team managed to mount a successful comeback from a double-digit deficit 
double_digit_deficits_overcome <- filter(nfl_data, (total_home_score - total_away_score	>= 10 & away_score > home_score) | (total_away_score - total_home_score >= 10 & home_score > away_score))

## Assess the plays from those games to find those games in which the coach's team managed to mount a 4th quarter comeback
fourth_quarter_comeback_games <- filter(nfl_data, qtr == 4, quarter_seconds_remaining	<= 810, (total_home_score > total_away_score & away_score > home_score) | (total_away_score > total_home_score & home_score > away_score))

## Crunch both datasets together and add flags denoting the type of comeback
comeback_games <- filter(nfl_data, (game_id %in% double_digit_deficits_overcome$game_id | game_id %in% fourth_quarter_comeback_games$game_id)) %>%
  mutate(double_digit_comeback = (ifelse (game_id %in% double_digit_deficits_overcome$game_id, TRUE, FALSE) ) ) %>%
  mutate(fourth_quarter_comeback = (ifelse (game_id %in% fourth_quarter_comeback_games$game_id, TRUE, FALSE) ) ) %>%
  mutate(comeback_team = ifelse(home_score > away_score, home_team, away_team)) %>%
  mutate(losing_team = ifelse(home_score > away_score, away_team, home_team)) %>%
  distinct(game_ref, .keep_all = TRUE) %>%
  select(game_ref, week, comeback_team, losing_team, double_digit_comeback, fourth_quarter_comeback)

## Calculate comebacks staged and comebacks surrendered by team
comebacks_staged_over_season <- group_by(comeback_games, comeback_team) %>%
  summarize(total_comebacks = n(), double_digit_deficits_overcome = sum(double_digit_comeback == TRUE), fourth_quarter_comebacks = sum(fourth_quarter_comeback == TRUE)) %>%
  arrange(desc(total_comebacks))
comebacks_surrendered_over_season <- group_by(comeback_games, losing_team) %>%
  summarize(total_comebacks_surrendered = n(), double_digit_deficits_surrendered = sum(double_digit_comeback == TRUE), fourth_quarters_surrendered = sum(fourth_quarter_comeback == TRUE)) %>%
  arrange(desc(total_comebacks_surrendered))
names(comebacks_staged_over_season)[names(comebacks_staged_over_season) == 'comeback_team'] <- 'team'
names(comebacks_surrendered_over_season)[names(comebacks_surrendered_over_season) == 'losing_team'] <- 'team'
comeback_analysis <- full_join(comebacks_staged_over_season, comebacks_surrendered_over_season) %>%
  full_join(team_list) %>%
  select(team, total_comebacks, total_comebacks_surrendered) %>%
  replace_na(list(total_comebacks = 0, total_comebacks_surrendered = 0))

# Upload the data to our database
teams_collection = mongo(collection = "teams", db = database_name, url = connection_string)

for (row in 1:nrow(comeback_analysis)) {
  query <- query_statement(comeback_analysis[row, 'team'])
  
  # Account for the number of times any team successfully staged a comeback
  t_updater <- team_update_statement('comebacks_staged', comeback_analysis[row, 'total_comebacks'])
  teams_collection$update(query, t_updater, upsert = FALSE)

  # Account for the number of times any team surrendered a comeback to an opponent
  t_updater <- team_update_statement('comebacks_surrendered', comeback_analysis[row, 'total_comebacks_surrendered'])
  teams_collection$update(query, t_updater, upsert = FALSE)
}