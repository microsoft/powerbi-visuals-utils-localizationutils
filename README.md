# Add visual to the list for localizations update
1) Add new repo to folder “visuals” as submodule 
    $ cd visuals
    $ git submodule add `URL`
2) Add LocItem to LocProject.json
3) Create pull request with your changes to main branch

# Configure new repo settings
4) Add `pbicvloc` and `pbicvloc2` as collaborators with "Write" access (first one makes changes, second one approves pull requests with changes)
5) Go to settings > general > scroll down to `Pull Requests` > find and set to true `Allow auto-merge`

