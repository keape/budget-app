// TokenSyncModule.m
// NativeModule React Native — copia il token JWT in UserDefaults con App Group
// Il widget iOS legge da lì, senza dover accedere ad AsyncStorage

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>

// App Group identifier — deve corrispondere a quello configurato nelle capabilities
static NSString *const kAppGroupIdentifier = @"group.com.budget365.sharing";
static NSString *const kTokenKey = @"widget_token";
static NSString *const kUsernameKey = @"widget_username";
static NSString *const kLastSyncKey = @"widget_last_sync";

@interface TokenSyncModule : NSObject <RCTBridgeModule>
@end

@implementation TokenSyncModule

RCT_EXPORT_MODULE();

- (NSUserDefaults *)sharedDefaults {
    return [[NSUserDefaults alloc] initWithSuiteName:kAppGroupIdentifier];
}

RCT_EXPORT_METHOD(syncToken:(NSString *)token
                  username:(NSString *)username
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    @try {
        NSUserDefaults *defaults = [self sharedDefaults];
        if (defaults == nil) {
            reject(@"APP_GROUP_NOT_FOUND", @"App Group group.com.budget365.sharing non configurato. Aggiungilo nelle Capabilities del target Budget365 in Xcode.", nil);
            return;
        }

        [defaults setObject:token forKey:kTokenKey];
        [defaults setObject:username forKey:kUsernameKey];
        [defaults setDouble:[[NSDate date] timeIntervalSince1970] forKey:kLastSyncKey];
        [defaults synchronize];

        resolve(@{@"success": @YES, @"username": username ?: @""});
    } @catch (NSException *exception) {
        reject(@"SYNC_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(clearToken:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    @try {
        NSUserDefaults *defaults = [self sharedDefaults];
        if (defaults == nil) {
            reject(@"APP_GROUP_NOT_FOUND", @"App Group non configurato", nil);
            return;
        }

        [defaults removeObjectForKey:kTokenKey];
        [defaults removeObjectForKey:kUsernameKey];
        [defaults synchronize];

        resolve(@{@"success": @YES});
    } @catch (NSException *exception) {
        reject(@"CLEAR_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(getToken:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    @try {
        NSUserDefaults *defaults = [self sharedDefaults];
        if (defaults == nil) {
            reject(@"APP_GROUP_NOT_FOUND", @"App Group non configurato", nil);
            return;
        }

        NSString *token = [defaults stringForKey:kTokenKey];
        NSString *username = [defaults stringForKey:kUsernameKey];

        if (token == nil) {
            resolve(@{@"hasToken": @NO});
        } else {
            resolve(@{
                @"hasToken": @YES,
                @"token": token,
                @"username": username ?: @""
            });
        }
    } @catch (NSException *exception) {
        reject(@"GET_ERROR", exception.reason, nil);
    }
}

@end
