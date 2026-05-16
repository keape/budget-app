#!/usr/bin/env ruby
# Configura DerivedData path esterno a iCloud per evitare xattr che rompono codesign
require 'xcodeproj'

PROJECT_PATH = File.expand_path("~/Documents/budget365/budget365iOS/ios/Budget365.xcodeproj")
DERIVED_DATA = "/tmp/budget365-derived"

project = Xcodeproj::Project.open(PROJECT_PATH)

# Imposta DerivedData a livello di progetto (si applica a tutti i target)
project.build_configurations.each do |config|
  config.build_settings['CONFIGURATION_BUILD_DIR'] = "#{DERIVED_DATA}/Build/Products/#{config.name}"
  config.build_settings['DWARF_DSYM_FOLDER_PATH'] = "#{DERIVED_DATA}/Build/Products/#{config.name}"
  config.build_settings['OBJROOT'] = "#{DERIVED_DATA}/Build/Intermediates.noindex"
  config.build_settings['SYMROOT'] = "#{DERIVED_DATA}/Build/Products"
  config.build_settings['SHARED_PRECOMPS_DIR'] = "#{DERIVED_DATA}/Build/PrecompiledHeaders"
end

project.save
puts "✅ DerivedData configurato: #{DERIVED_DATA}"
puts "   BUILD_DIR = #{DERIVED_DATA}"
puts ""
puts "⚠️  Xcode va chiuso e riaperto per applicare le modifiche."
