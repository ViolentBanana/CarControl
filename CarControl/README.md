
打包
xcodebuild -exportArchive \
           -archivePath ./build/CarControl.xcarchive \
           -exportPath ./build/CarControlIPA \
           -exportOptionsPlist ./ExportOptions.plist
