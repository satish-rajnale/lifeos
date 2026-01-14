Pod::Spec.new do |s|
  s.name           = 'text-to-speech'
  s.version        = '1.0.0'
  s.summary        = 'Text to speech module for React Native'
  s.license        = 'MIT'
  s.author         = ''
  s.homepage       = ''
  s.platforms      = { :ios => '13.4' }
  s.swift_version  = '5.4'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
