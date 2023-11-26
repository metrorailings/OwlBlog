query_statement <- function(abbrev) {
  paste0('{"abbrev": "', abbrev, '"}')
}
offense_update_statement <- function(key, value) {
  paste0('{ "$set": { "offense.', key, '": ', value, ' }}')
}
defense_update_statement <- function(key, value) {
  paste0('{ "$set": { "defense.', key, '": ', value, ' }}')
}
special_teams_update_statement <- function(key, value) {
  paste0('{ "$set": { "special_teams.', key, '": ', value, ' }}')
}
team_update_statement <- function(key, value) {
  paste0('{ "$set": { "team.', key, '": ', value, ' }}')
}