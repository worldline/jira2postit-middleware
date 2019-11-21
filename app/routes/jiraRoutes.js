'use strict';
module.exports = function(app) {
    var controller = require('../controllers/jiraController');

    // checks that provided credentials work by getting the board
    app.route('/login')
        .post(controller.login);
    // gets the sprints for the board (see how to add search parameters future/active)
    app.route('/board/:boardId/sprint')
        .get(controller.read_sprints);
    // gets issues for sprint (see how to add the wanted return fields: components, summary, epic, fixVersions, priority, key, assignee)
    app.route('/board/:boardId/sprint/:sprintId/issue')
        .get(controller.read_sprintIssues);
    // get issueTypes for project
    app.route('/board/:boardId/project/:projectKey/issueTypes')
        .get(controller.read_issueTypes);
    app.route('/logout')
        .get(controller.logout);
    app.route('/board/:boardId/issue')
        .get(controller.read_kanbanIssues);
    app.route('/board/:boardId/settings')
        .get(controller.read_configuration)
        .post(controller.write_configuration);
        
}
