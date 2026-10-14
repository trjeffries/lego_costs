# WELCOME to my LEGO costs project!

## What is it?

Good question! It's a project I set up, based on a question I've been wondering for a long time now (inspired by [Brickset](https://www.brickset.com/) commenters), to develop (and, let's face it, display) my coding skills, and it's split into three parts.

### dbt_project

A dbt core setup, to work on SQL and dbt skills. Combines multiple CSV sources, and outputs to one individual file which I'm then using to create charts and tables to show online. Previously used DuckDB, nows uses SQLite, for reasons that will become clear.

### python_project

A small detour I took into building a web app, due to having no knowlege of Python and wanting to develop that. Brief research showed me a good way of showing charts was to use Plotly and Dash, so I went down that route. It's largely an abandoned piece of work, though[^1]: there are several finished charts in there, and I'm happy enough with it that I'm confident for now saying "I know how to build charts in Python", but...

[^1]: There's a DuckDB file there with the output of the dbt workflow at the time I decided to move on from that, so if you want to take a look, feel free to download and run it.

### html_project

It struck me that actually, most charts online don't use Python at all, and that actually I don't want to rely on a third-party to host everything I do (he writes, on a website hosted by GitHub). So, I decided to throw that off for now and rebuild (and, in due course, complete) the project using plain old HTML, CSS and JavaScript. Never built a website before, this could be fun.
