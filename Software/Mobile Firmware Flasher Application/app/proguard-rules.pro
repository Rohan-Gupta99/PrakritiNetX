# Proguard rules for FieldFlash
-keepattributes *Annotation*
-keepclassmembers class * {
    @androidx.room.* <methods>;
    @androidx.room.* <fields>;
}
-keep class com.hoho.android.usbserial.** { *; }
-keep class org.prakritinetx.fieldflash.data.models.** { *; }
-keep class org.prakritinetx.fieldflash.data.db.entity.** { *; }

