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
nfl_data <- load_pbp(2023)
max_week <- max(nfl_data$week)
trailing_weeks <- c(max_week - 6, max_week - 5, max_week - 4, max_week - 3, max_week - 2, max_week - 1, max_week)

# Focus only on plays from the weeks we're analyzing
adjusted_plays <- filter(nfl_data, week %in% trailing_weeks)

# Normalize the EPA on all plays that resulted in a turnover, considering those plays are generally unpredictable
adjusted_plays <- mutate(adjusted_plays, epa = ifelse(fumble_forced == 1 | interception == 1, -2, epa))
adjusted_plays <- mutate(adjusted_plays, epa = ifelse(fumble_not_forced == 1, -1, epa))

# Strip all plays that do not really matter for EPA and focus only on passess and runs
adjusted_plays = filter(adjusted_plays, qb_kneel == FALSE, qb_spike == FALSE, (play_type == 'pass' | play_type == 'run'))

# Calculate the average EPA per play for both offenses and defenses
offensive_epa <- group_by(adjusted_plays, posteam) %>%
  summarize(total_plays = n(), o_epa_per_play = round(mean(epa), 2)) %>%
  select(posteam, o_epa_per_play) %>%
  arrange(posteam)
defensive_epa <- group_by(adjusted_plays, defteam) %>%
  summarize(total_plays = n(), d_epa_per_play = round(mean(epa), 2)) %>%
  select(defteam, d_epa_per_play) %>%
  arrange(defteam)
names(offensive_epa)[names(offensive_epa) == 'posteam'] <- 'abbrev'
names(defensive_epa)[names(defensive_epa) == 'defteam'] <- 'abbrev'

# Figure out the standard deviation 
mean_offensive_epa = mean(offensive_epa$o_epa_per_play)
sd_offensive_epa = sd(offensive_epa$o_epa_per_play)
mean_defensive_epa = mean(defensive_epa$d_epa_per_play)
sd_defensive_epa = sd(defensive_epa$d_epa_per_play)
offensive_epa <- mutate(offensive_epa, o_epa_per_play_sd = round((o_epa_per_play - mean_offensive_epa) / sd_offensive_epa, 3))
defensive_epa <- mutate(defensive_epa, d_epa_per_play_sd = round((mean_defensive_epa - d_epa_per_play) / sd_defensive_epa, 3))
epa_data <- inner_join(offensive_epa, defensive_epa)

# Upload the data to our database
teams_collection = mongo(collection = "teams", db = database_name, url = connection_string)

for (row in 1:nrow(epa_data)) {
  query <- query_statement(epa_data[row, 'abbrev'])
  
  # Update the raw EPA mean going back the past several weeks
  o_updater <- offense_update_statement('trailing_epa_per_play', epa_data[row, 'o_epa_per_play'])
  d_updater <- defense_update_statement('trailing_epa_per_play', epa_data[row, 'd_epa_per_play'])
  teams_collection$update(query, o_updater, upsert = FALSE)
  teams_collection$update(query, d_updater, upsert = FALSE)

  # Update the EPA-related standard deviation data
  o_updater <- offense_update_statement('trailing_epa_per_play_sd', epa_data[row, 'o_epa_per_play_sd'])
  d_updater <- defense_update_statement('trailing_epa_per_play_sd', epa_data[row, 'd_epa_per_play_sd'])
  teams_collection$update(query, o_updater, upsert = FALSE)
  teams_collection$update(query, d_updater, upsert = FALSE)
}