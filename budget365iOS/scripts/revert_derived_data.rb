#!/usr/bin/env ruby
# Revert: rimuovi le impostazioni CONFIGURATION_BUILD_DIR dal progetto
# (erano invasive, meglio DerivedData fuori iCloud via flag di xcodebuild)
require 'xcodeproj'

PROJECT_PATH = File.expand_path("~/Documents/budget365/budget365iOS/ios/Budget365.xcodeproj")

project = Xcodeproj::Project.open(PROJECT_PATH)

project.build_configurations.each do |config|
  config.build_settings.delete('CONFIGURATION_BUILD_DIR')
  config.build_settings.delete('DWARF_DSYM_FOLDER_PATH')
  config.build_settings.delete('OBJROOT')
  config.build_settings.delete('SYMROOT')
  config.build_settings.delete('SHARED_PRECOMPS_DIR')
end

project.save
puts "✅ Impostazioni DerivedData rimosse dal progetto"
