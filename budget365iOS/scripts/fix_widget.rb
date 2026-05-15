#!/usr/bin/env ruby
# Fix post-creazione per il widget Budget365Widget
require 'xcodeproj'

PROJECT_PATH = File.expand_path("~/Documents/budget365/budget365iOS/ios/Budget365.xcodeproj")

project = Xcodeproj::Project.open(PROJECT_PATH)
widget_target = project.targets.find { |t| t.name == "Budget365Widget" }
raise "❌ Target Budget365Widget non trovato!" unless widget_target

puts "✅ Target trovato: #{widget_target.name}"

# Fix 1: PRODUCT_NAME deve essere esplicito
widget_target.build_configurations.each do |config|
  config.build_settings['PRODUCT_NAME'] = '$(TARGET_NAME)'
end
puts "✅ PRODUCT_NAME impostato a TARGET_NAME"

# Fix 2: Rimuovere Info.plist dalla Copy Bundle Resources phase
resources_phase = widget_target.resources_build_phase
resources_phase.files.each do |f|
  if f.file_ref&.path&.include?("Info.plist")
    resources_phase.remove_file_reference(f.file_ref)
    puts "✅ Info.plist rimosso da Copy Bundle Resources"
  end
end

# Fix 3: Assicurarsi che INFOPLIST_FILE sia corretto  
widget_target.build_configurations.each do |config|
  config.build_settings['INFOPLIST_FILE'] = 'Budget365Widget/Info.plist'
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = '$(BUNDLE_ID_PREFIX).Budget365Widget'
end
puts "✅ INFOPLIST_FILE e BUNDLE_ID verificati"

# Fix 4: Install
widget_target.build_configurations.each do |config|
  config.build_settings['SKIP_INSTALL'] = 'NO'
  config.build_settings['INSTALL_PATH'] = '$(LOCAL_APPS_DIR)'
end
puts "✅ SKIP_INSTALL=NO per distribuzione"

project.save
puts "\n✅✅✅ Fix applicati con successo!"
