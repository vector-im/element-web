Theming Element
============

Themes are a very basic way of providing simple alternative look & feels to the
Element app via CSS & custom imagery.

They are *NOT* co be confused with 'skins', which describe apps which sit on top
of matrix-react-sdk - e.g. in theory Element itself is a react-sdk skin.
As of Jan 2017, skins are not fully supported; Element is the only available skin.

To define a theme for Element:

 1. Pick a name, e.g. `teal`. at time of writing we have `light` and `dark`.
 2. Fork `src/skins/vector/css/themes/dark.scss` to be `teal.scss`
 3. Fork `src/skins/vector/css/themes/_base.scss` to be `_teal.scss`
 4. Override variables in `_teal.scss` as desired. You may wish to delete ones
    which don't differ from `_base.scss`, to make it clear which are being
    overridden. If every single colour is being changed (as per `_dark.scss`)
    then you might as well keep them all.
 5. Add the theme to the list of entrypoints in webpack.config.js
 6. Add the theme to the list of themes in matrix-react-sdk's UserSettings.js
 7. Sit back and admire your handywork.

In future, the assets for a theme will probably be gathered together into a
single directory tree.

Custom Themes
=============

Themes derived from the built in themes may also be defined in settings.

To avoid name collisions, the internal name of a theme is
`custom-${theme.name}`. So if you want to set the custom theme below as the
default theme, you would use `default_theme: "custom-Electric Blue"`.

eg. in config.json:

```
"settingDefaults": {
        "custom_themes": [
            {
                "name": "Electric Blue",
                "is_dark": false,
                "fonts": {
                    "faces": [
                        {
                            "font-family": "Inter",
                            "src": [{"url": "/fonts/Inter.ttf", "format": "ttf"}]
                        }
                    ],
                    "general": "Inter, sans",
                    "monospace": "'Courier New'"
                },
                "colors": {
                    "accent-color": "#3596fc",
                    "primary-color": "#368bd6",
                    "warning-color": "#ff4b55",
                    "sidebar-color": "#27303a",
                    "roomlist-background-color": "#f3f8fd",
                    "roomlist-text-color": "#2e2f32",
                    "roomlist-text-secondary-color": "#61708b",
                    "roomlist-highlights-color": "#ffffff",
                    "roomlist-separator-color": "#e3e8f0",
                    "timeline-background-color": "#ffffff",
                    "timeline-text-color": "#2e2f32",
                    "timeline-text-secondary-color": "#61708b",
                    "timeline-highlights-color": "#f3f8fd",
                    "username-colors": ["#ff0000"],
                    "avatar-background-colors": ["#cc0000"]
                }
            }, {
                "name": "Deep Purple",
                "is_dark": true,
                "colors": {
                    "accent-color": "#6503b3",
                    "primary-color": "#368bd6",
                    "warning-color": "#b30356",
                    "sidebar-color": "#15171B",
                    "roomlist-background-color": "#22262E",
                    "roomlist-text-color": "#A1B2D1",
                    "roomlist-text-secondary-color": "#EDF3FF",
                    "roomlist-highlights-color": "#343A46",
                    "roomlist-separator-color": "#a1b2d1",
                    "timeline-background-color": "#181b21",
                    "timeline-text-color": "#EDF3FF",
                    "timeline-text-secondary-color": "#A1B2D1",
                    "timeline-highlights-color": "#22262E"
                }
            }
        ]
    }
```

`username-colors` is expected to contain 8 colors. `avatar-background-colors` is expected to contain 3 colors. Both values are optional and have fallbacks from the built-in theme.

These are exposed as `--username-colors_0`, ... and `--avatar-background-colors_0`, ... respectively in CSS.

All properties in `fonts` are optional, and will default to the standard Riot fonts.
