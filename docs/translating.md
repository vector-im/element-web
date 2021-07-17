# How to translate Element

## Requirements

- Web Browser
- Be able to understand English
- Be able to understand the language you want to translate Element into

## Step 0: Join #element-translations:matrix.org

1. Come and join https://matrix.to/#/#element-translations:matrix.org
2. Read scrollback and/or ask if anyone else is working on your language, and co-ordinate if needed.  In general little-or-no coordination is needed though :)

## Step 1: Preparing your Weblate Profile

1. Head to https://translate.element.io and register either via Github or email
2. After registering check if you got an email to verify your account and click the link (if there is none head to step 1.4)
3. Log into weblate
4. Head to https://translate.element.io/accounts/profile/ and select the languages you know and maybe another language you know too.

## How to check if your language already is being translated

Go to https://translate.element.io/projects/element-web/ and visit the 2 sub-projects.
If your language is listed go to Step 2a and if not go to Step 2b

## Step 2a: Helping on existing languages.

1. Head to one of the projects listed https://translate.element.io/projects/element-web/
2. Click on the ``translate`` button on the right side of your language
3. Fill in the translations in the writeable field. You will see the original English string and the string of your second language above.

Head to the explanations under Steb 2b

## Step 2b: Adding a new language

1. Go to one of the projects listed https://translate.element.io/projects/element-web/
2. Click the ``Start new translation`` button at the bottom
3. Select a language
4. Start translating like in 2a.3
5. Repeat these steps for the other projects which are listed at the link of step 2b.1

### What means the green button under the text field?

The green button let you save our translations directly. Please only use it if you are 100% sure about that translation. If you do not know a translation please DO NOT click that button. Use the arrows above the translations field and click to the right.

### What means the yellow button under the text field?

The yellow button has to be used if you are unsure about the translation but you have a rough idea. It adds a new suggestion to the string which can than be reviewed by others.

### What are "%(something)s"?

These things are variables that are expanded when displayed by Element. They can be room names, usernames or similar. If you find one, you can move to the right place for your language, but not delete it as the variable will be missing if you do.

A special case is `%(urlStart)s` and `%(urlEnd)s` which are used to mark the beginning of a hyperlink (i.e. `<a href="/somewhere">` and `</a>`.  You must keep these markers surrounding the equivalent string in your language that needs to be hyperlinked.

### "I want to come back to this string. How?"

You can use inside the translation field "Review needed" checkbox. It will be shown as Strings that need to be reviewed.


### Further reading

The official Weblate doc provides some more in-deepth explanation on how to do translations and talks about do and don'ts. You can find it at: https://docs.weblate.org/en/latest/user/translating.html
