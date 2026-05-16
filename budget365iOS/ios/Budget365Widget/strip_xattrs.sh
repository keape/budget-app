#!/bin/bash
# Strip extended attributes from build product before codesign
find "${TARGET_BUILD_DIR}/${PRODUCT_NAME}.appex" -exec xattr -cr {} \; 2>/dev/null
