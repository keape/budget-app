#!/usr/bin/env ruby
# Aggiunge Run Script phase per strip xattrs PRIMA del codesign
require 'xcodeproj'

PROJECT_PATH = File.expand_path("~/Documents/budget365/budget365iOS/ios/Budget365.xcodeproj")

project = Xcodeproj::Project.open(PROJECT_PATH)
widget_target = project.targets.find { |t| t.name == "Budget365Widget" }
raise "❌ Target Budget365Widget non trovato!" unless widget_target

puts "✅ Target trovato: #{widget_target.name}"

# Trova la codesign phase e posiziona la Run Script phase PRIMA
codesign_index = nil
widget_target.build_phases.each_with_index do |phase, idx|
  if phase.isa == "PBXSourcesBuildPhase"
    # This is the compile sources phase
  end
end

# Cerca se esiste già una script phase per xattr strip
existing_strip = widget_target.shell_script_build_phases.find { |p|
  p.name == "Strip Extended Attributes"
}

if existing_strip
  puts "ℹ️ Strip phase già presente, skippo"
else
  # Aggiungi Run Script phase
  strip_phase = widget_target.new_shell_script_build_phase("Strip Extended Attributes")
  
  # Imposta lo script
  strip_phase.shell_script = 'xattr -cr "${TARGET_BUILD_DIR}/${PRODUCT_NAME}.appex" 2>/dev/null; xattr -cr "${TARGET_BUILD_DIR}/${PRODUCT_NAME}.appex/" 2>/dev/null; exit 0'
  strip_phase.shell_path = "/bin/bash"
  strip_phase.input_paths = []
  strip_phase.output_paths = []
  
  # Sposta la shell script phase PRIMA del codesign
  # Framework phase usually comes after compile but before embed/copy
  # We want it after the compile phase but before the last phase (which should be codesign/embed)
  # Better: move it right after the resources/copy phases, before the embed extensions phase
  
  puts "✅ Run Script 'Strip Extended Attributes' aggiunta"
  
  # Sposta la phase dopo Copy Bundle Resources
  resources_phase = widget_target.resources_build_phase
  if resources_phase
    widget_target.build_phases.move(strip_phase, resources_phase)
    puts "✅ Phase spostata dopo Copy Bundle Resources"
  end
end

project.save
puts "\n✅✅✅ Fix xattr applicato!"

# Verifica l'ordine delle build phases
puts "\nBuild phases ordine:"
widget_target.build_phases.each_with_index do |p, i|
  puts "  #{i}: #{p.name || p.isa}"
end
