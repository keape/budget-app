#!/usr/bin/env ruby
# Script per aggiungere il widget Budget365Widget al progetto Xcode
# Crea il target Widget Extension, aggiunge i file Swift, configura App Group

require 'xcodeproj'

PROJECT_PATH = File.expand_path("~/Documents/budget365/budget365iOS/ios/Budget365.xcodeproj")
WIDGET_DIR = File.expand_path("~/Documents/budget365/budget365iOS/ios/Budget365Widget")
MAIN_APP_DIR = File.expand_path("~/Documents/budget365/budget365iOS/ios/Budget365")
APP_GROUP_ID = "group.com.budget365.sharing"

# Apri progetto
project = Xcodeproj::Project.open(PROJECT_PATH)
puts "✅ Progetto aperto: #{project.path}"

# Trova il target principale
main_target = project.targets.find { |t| t.name == "Budget365" }
raise "❌ Target Budget365 non trovato!" unless main_target
puts "✅ Target principale: #{main_target.name} (bundle: #{main_target.product_type})"

# === 1. AGGIUNGI TokenSyncModule.m al target principale ===
token_sync_path = File.join(MAIN_APP_DIR, "TokenSyncModule.m")
if File.exist?(token_sync_path)
  # Verifica se è già nel progetto
  existing_file = main_target.source_build_phase.files.find do |f|
    f.file_ref&.real_path&.to_s == token_sync_path
  end
  unless existing_file
    file_ref = project.new_file(token_sync_path)
    main_target.source_build_phase.add_file_reference(file_ref)
    puts "✅ TokenSyncModule.m aggiunto al target Budget365"
  else
    puts "ℹ️ TokenSyncModule.m già presente nel target Budget365"
  end
end

# === 2. CREA TARGET WIDGET EXTENSION ===
widget_target_name = "Budget365Widget"
existing_widget = project.targets.find { |t| t.name == widget_target_name }

if existing_widget
  puts "ℹ️ Target #{widget_target_name} già esistente, lo aggiorno"
  widget_target = existing_widget
else
  # Crea il nuovo target per widget extension
  # Product type per widget extension: com.apple.product-type.app-extension
  widget_target = project.new_target(
    :app_extension,        # type
    widget_target_name,    # name
    :ios,                  # platform
    "com.budget365.widget" # product_bundle_identifier (placeholder, verrà sovrascritto)
  )
  puts "✅ Target #{widget_target_name} creato"
end

# Configura build settings del widget target
widget_target.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = '$(BUNDLE_ID_PREFIX).Budget365Widget'
  config.build_settings['INFOPLIST_FILE'] = 'Budget365Widget/Info.plist'
  config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['DEVELOPMENT_TEAM'] = main_target.build_configurations.first.build_settings['DEVELOPMENT_TEAM']
  config.build_settings['BUNDLE_ID_PREFIX'] = main_target.build_configurations.first.build_settings['PRODUCT_BUNDLE_IDENTIFIER'].gsub(/\.Budget365$/, '')
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'Budget365Widget/Budget365Widget.entitlements'
end

# === 3. AGGIUNGI FILE SWIFT AL WIDGET TARGET ===
widget_files = Dir.glob(File.join(WIDGET_DIR, "*.swift"))
widget_files.each do |swift_file|
  existing = widget_target.source_build_phase.files.find do |f|
    f.file_ref&.real_path&.to_s == swift_file
  end
  unless existing
    file_ref = project.new_file(swift_file)
    widget_target.source_build_phase.add_file_reference(file_ref)
    puts "✅ #{File.basename(swift_file)} aggiunto al target widget"
  else
    puts "ℹ️ #{File.basename(swift_file)} già presente"
  end
end

# === 4. AGGIUNGI Info.plist al widget target (come risorsa) ===
widget_plist = File.join(WIDGET_DIR, "Info.plist")
existing_plist = widget_target.resources_build_phase.files.find do |f|
  f.file_ref&.real_path&.to_s == widget_plist
end
unless existing_plist
  file_ref = project.new_file(widget_plist)
  widget_target.resources_build_phase.add_file_reference(file_ref)
  puts "✅ Info.plist aggiunto al target widget"
end

# === 5. AGGIUNGI FRAMEWORK AL WIDGET TARGET ===
# WidgetKit e SwiftUI sono necessari
["WidgetKit", "SwiftUI"].each do |framework|
  widget_target.add_system_framework(framework)
  puts "✅ #{framework}.framework aggiunto al target widget"
end

# === 6. CONFIGURA APP GROUP CAPABILITY ===
# Per il target principale
main_target.build_configurations.each do |config|
  entitlements = config.build_settings['CODE_SIGN_ENTITLEMENTS'] || 'Budget365/Budget365.entitlements'
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = entitlements
end

# Per il widget target (già fatto sopra con CODE_SIGN_ENTITLEMENTS)

# === 7. AGGIUNGI WIDGET COME TARGET DIPENDENZA ===
# Il target principale deve avere il widget come dipendenza
unless main_target.dependencies.any? { |d| d.target == widget_target }
  main_target.add_dependency(widget_target)
  puts "✅ Widget aggiunto come dipendenza del target principale"
end

# === 8. AGGIUNGI COPY FILES PHASE PER INCLUSIONE WIDGET NELL'APP BUNDLE ===
# I widget extension devono essere copiati nel bundle dell'app
copy_files_phase_name = "Embed App Extensions"
copy_phase = main_target.copy_files_build_phases.find { |p| p.name == copy_files_phase_name }
unless copy_phase
  copy_phase = main_target.new_copy_files_build_phase(copy_files_phase_name)
  copy_phase.symbol_dst_subfolder_spec = :products_directory
  puts "✅ Copy Files phase creata per widget extension"
end

# Aggiungi il prodotto del widget alla copy phase
widget_product = project.products.find { |p| p.path == "#{widget_target_name}.appex" }
if widget_product
  unless copy_phase.files.any? { |f| f.file_ref == widget_product }
    copy_phase.add_file_reference(widget_product)
    puts "✅ Widget .appex aggiunto alla copy phase"
  end
end

# === 9. SALVA ===
project.save
puts "\n✅✅✅ Progetto salvato con successo!"
puts "   Target creato/aggiornato: #{widget_target_name}"
puts "   File Swift aggiunti: #{widget_files.length}"
puts "   App Group: #{APP_GROUP_ID}"
puts ""
puts "⚠️  Ora apri il progetto in Xcode e verifica:"
puts "   1. Budget365Widget target → Signing & Capabilities → App Groups → spunta #{APP_GROUP_ID}"
puts "   2. Budget365 target → Signing & Capabilities → App Groups → spunta #{APP_GROUP_ID}"
puts "   3. Build (⌘B) per verificare che compili"