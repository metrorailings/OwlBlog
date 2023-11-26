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

# Organize all rushing plays and passing plays
rushing_plays <- filter(nfl_data, play_type == 'run', qb_scramble == 0) %>%
  group_by(posteam) %>%
  summarize(total_rushing_plays = n(), total_rushing_yards_gained	= sum(yards_gained))
passing_plays <- filter(nfl_data, (play_type == 'pass' | qb_scramble == 1)) %>%
  group_by(posteam) %>%
  summarize(total_passing_plays = n(), total_passing_yards_gained	= sum(yards_gained))
all_plays <- inner_join(rushing_plays, passing_plays, by = 'posteam') %>%
  mutate(total_plays = (total_rushing_plays + total_passing_plays), run_ratio = round(total_rushing_plays / total_plays, 3), pass_ratio = round(total_passing_plays / total_plays, 3)) %>%
  arrange(run_ratio)

# Plot out the data so that it's easier to comprehend
ggplot(all_plays, aes(x = pass_ratio, y = run_ratio)) +
  geom_nfl_logos(aes(team_abbr = posteam), width = 0.035) +
  scale_x_continuous(breaks = seq(0, 1, 0.05)) +
  scale_y_continuous(breaks = seq(0, 1, 0.05)) +
  labs(
    x = "Pass Frequency",
    y = "Run Frequency",
    caption = "Data: @nflfastR",
    title = "2022 NFL Pass/Run Ratio"
  ) +
  theme_minimal()