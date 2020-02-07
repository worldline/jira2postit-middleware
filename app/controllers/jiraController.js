'use strict';
var User = require('../models/user');
let httpsProxyAgent = require('https-proxy-agent');
var axios = require('axios');
var config = require('../configuration/configuration');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const program = require('commander');
const adapter = new FileSync(config.get('db:path') + 'db.json');
const DEBUG = process.env.NODE_ENV === 'development';

const db = low(adapter)
db.defaults({ configurations: [] })
  .write()


axios.defaults.baseURL = program.jiraUrl;
axios.defaults.headers.common['Content-Type'] = 'application/json';
const proxyAddress = program.proxy || config.get('app:proxy');
if (proxyAddress) {
    var agent = new httpsProxyAgent(proxyAddress);
    agent.rejectUnauthorized = false;
    axios.defaults.httpsAgent = agent;
}

axios.interceptors.response.use((response) => {
    console.log(`${response.status} ${response.request.method} ${response.request.path} for user: ${response.config.auth.username}`);
    if (DEBUG) {
        console.log(response.data);
    }
    return response;
}, (error) => {
    console.log(`Error: ${error.response.status} ${error.config.method} ${error.config.url} for user: ${error.config.auth.username}`);
    if (error.message) {
        console.log('Error', error.message);
    }
    if (DEBUG) {
        console.log(error.response.data);
    }

    return Promise.reject(error);
});

exports.read_configuration = function(req, res) {
    const configuration = db.get('configurations')
        .find({id: req.params['boardId']})
        .value()
    if (!configuration) {
        res.status(404);
        res.end();
    } else {
        res.send(configuration.data);
    }
}

exports.write_configuration = function(req, res) {
    const configuration = req.body;
    const boardId = req.params['boardId'];
    const configurationFromDb = db.get('configurations')
        .find({id: req.params['boardId']})
        .value();
    if (configurationFromDb) {
        db.get('configurations')
            .find({ id: boardId })
            .assign({ data: configuration})
            .write()
    } else {
        db.get('configurations')
            .push({ id: boardId, data: configuration })
            .write();
    }
    res.send(configuration);
}

exports.login = function(req, res) {
    axios
        .get(`/agile/1.0/board/${req.body.boardId}`, { auth: { 'username': `${req.body.username}`, 'password': `${req.body.password}` }})
        .then(response => {
            var user = new User(req.body.username, req.body.password);
            req.session.user = user;
            res.send(response.data);
            req.session.save();
        })
        .catch(error => {
            res.status(401).send('Sorry, your credentials or the board id are wrong!');
        });
};

exports.logout = function(req, res) {
    if (req.session.user) {
        req.session.destroy((err) => {
            if (err) {
              next(err)
              res.status(500).send()
            } else {
              res.clearCookie('id')
              res.status(204).send()
            }
          })
    } else {
        res.status(401).send()
    }
};

exports.read_issueTypes = function(req,res) {
    const projectKey = req.params['projectKey']
    if (req.session.user) {
        axios
            .get(`/api/2/project/${projectKey}`,
                {auth: { 'username': `${req.session.user.name}`,
                         'password': `${req.session.user.password}` }
                })
            .then(response => {
                let issueTypes = response.data.issueTypes.map(issueType => {
                    var type = {};
                    if (issueType.id) {
                        type.id = issueType.id;
                    }
                    if (issueType.name) {
                        type.name = issueType.name;
                    }
                    type.subtask = (issueType.subtask) ? issueType.subtask : false;
                    return type;
                });
                res.send(issueTypes);
            })
            .catch(error => {
                res.status(error.response.status).send(response.data)
            });
    } else {
        res.status(401).send()
    }
}

exports.read_sprints = function(req, res) {
    const boardId = req.params['boardId']
    if (req.session.user) {
        axios
            .get(`/agile/1.0/board/${boardId}/sprint?state=active,future`,
                 {auth: { 'username': `${req.session.user.name}`,
                          'password': `${req.session.user.password}` }
                 })
            .then(response => {
                res.setHeader('Content-Type', 'application/json');
                res.send(response.data);
            })
            .catch(error => {
                res.status(error.response.status).send(response.data);
            });
    } else {
        res.status(401).send()
    }
};

exports.read_sprintIssues = function(req, res) {
    const boardId = req.params['boardId']
    const sprintId = req.params['sprintId']
    if (req.session.user) {
        axios
            .get(`/agile/1.0/board/${boardId}/configuration`,
                {auth: { 'username': `${req.session.user.name}`,
                         'password': `${req.session.user.password}` }
            })
            .then(response => {
                var estimationField
                var fields = `fields=key&fields=summary&fields=issuetype&fields=summary&fields=epic&fields=status&fields=components`
                if (response.data.estimation && response.data.estimation.field.fieldId) {
                    estimationField = response.data.estimation.field.fieldId;
                    fields += `&fields=${estimationField}`
                }
                readPaginatedSprintIssues(boardId, sprintId, fields, req.session.user.name, req.session.user.password).then(data => {
                    var issues = formatSprintIssues(data, estimationField);
                    res.setHeader('Content-Type', 'application/json');
                    res.send(issues);
                });
            })
    } else {
        res.status(401).send()
    }
}

function readPaginatedSprintIssues(boardId, sprintId, fields, username, password, data = [], page = 0){
    let maxResult = 100;
    return axios
        .get(`/agile/1.0/board/${boardId}/sprint/${sprintId}/issue?${fields}&startAt=${maxResult*page}&maxResults=${maxResult}`,
            { auth: { 'username': `${username}`,
                    'password': `${password}` }
            })
        .then(response => {
            data = data.concat(response.data.issues);
            if (data.length !== response.data.total) {
                return readPaginatedSprintIssues(boardId, sprintId, fields, username, password, data, page + 1);
            }
            return data;
        })
        .catch(error => {
            res.status(error.response.status).send('Sorry, we cannot find that!');
        });
}

function formatSprintIssues(data, estimationField) {
    let reformattedData = data.map(issue => {
        delete issue.expand;
        delete issue.id;
        delete issue.self;
        if (issue.fields.summary) {
            issue["summary"] = issue.fields.summary;
        }
        if (issue.fields.issuetype) {
            issue["type"] = issue.fields.issuetype.name;
        }
        if (issue.fields.components) {
            issue["components"] = issue.fields.components.map(component => component.name);
        }
        if (issue.fields.status) {
            issue["status"] = issue.fields.status.name;
        }
        if (issue.fields.epic) {
            issue["epic"] = { name: issue.fields.epic.name, key: issue.fields.epic.key };;
        }
        if (issue.fields[`${estimationField}`]) {
            let formattedEstimation = issue.fields[`${estimationField}`];
            if (`${estimationField}` == 'timeoriginalestimate') {
                formattedEstimation = secondsToDhm(formattedEstimation);
            }
            issue["complexity"] = formattedEstimation;
        }
        delete issue.fields;
    });
    return data
}

exports.read_kanbanIssues = function(req, res) {
    const boardId = req.params['boardId']
    if (req.session.user) {
        axios
            .get(`/agile/1.0/board/${boardId}/configuration`,
                {auth: { 'username': `${req.session.user.name}`,
                         'password': `${req.session.user.password}` }
            })
            .then(response => {
                let statusesGroupedByColumn = response.data.columnConfig.columns
                    .reduce((acc,cur) => acc.concat({'name': cur.name, 'statusIds': cur.statuses.map(status => status.id)}), [])
                    .filter(column => column.statusIds.length > 0);
                const statuses = statusesGroupedByColumn.reduce((acc,cur) => acc.concat(cur.statusIds), []);
                const jql = `status IN (${statuses.toString()})`
                var estimationField
                var fields = `fields=issuetype&fields=summary&fields=epic&fields=status&fields=components`
                if (response.data.estimation && response.data.estimation.field.fieldId) {
                    estimationField = response.data.estimation.field.fieldId;
                    fields += `&fields=${estimationField}`
                }
                readPaginatedKanbanIssues(boardId, fields, jql, req.session.user.name, req.session.user.password).then(data => {
                    var issues = formatKanbanIssues(data, statusesGroupedByColumn, estimationField);
                    const columns = statusesGroupedByColumn.map(column => column.name);
                    const issuesGroupedByColumns = columns.map(column => {
                        var issueGroupedByColumn = {};
                        issueGroupedByColumn['name'] = column;
                        issueGroupedByColumn['issues'] = issues.filter(issue => column === issue.column);
                        return issueGroupedByColumn;
                    });
                    res.setHeader('Content-Type', 'application/json');
                    res.send(issuesGroupedByColumns);
                });
            })
            .catch(error => {
                res.status(error.response.status).send(response.data);
            });
    } else {
        res.status(401).send();
    }
};

function readPaginatedKanbanIssues(boardId, fields, jql, username, password, data = [], page = 0) {
    let maxResult = 100;
    return axios
        .get(`/agile/1.0/board/${boardId}/issue?${fields}&jql=${jql}&startAt=${maxResult*page}&maxResults=${maxResult}`,
            { auth: { 'username': `${username}`,
                    'password': `${password}` }
            })
        .then(response => {
            data = data.concat(response.data.issues);
            if (data.length !== response.data.total) {
                return readPaginatedKanbanIssues(boardId, fields, jql, username, password, data, page + 1);
            }
            return data;
        })
        .catch(error => {
            res.status(error.response.status).send('Sorry, we cannot find that!');
        });
}

function formatKanbanIssues(data, statusesGroupedByColumn, estimationField) {
    return data.map(issue => {
        delete issue.expand;
        delete issue.id;
        delete issue.self;
        if (issue.fields.summary) {
            issue["summary"] = issue.fields.summary;
        }
        if (issue.fields.issuetype) {
            issue["type"] = issue.fields.issuetype.name;
        }
        if (issue.fields.components) {
            issue["components"] = issue.fields.components.map(component => component.name);
        }
        if (issue.fields.status) {
            statusesGroupedByColumn.forEach(column => {
                if (column.statusIds.includes(issue.fields.status.id)) {
                    issue["column"] = column.name;
                }
            });
        }
        if (issue.fields.epic) {
            issue["epic"] = { name: issue.fields.epic.name, key: issue.fields.epic.key };;
        }
        if (issue.fields[`${estimationField}`]) {
            let formattedEstimation = issue.fields[`${estimationField}`];
            if (`${estimationField}` == 'timeoriginalestimate') {
                formattedEstimation = secondsToDhm(formattedEstimation);
            }
            issue["complexity"] = formattedEstimation;
        }
        delete issue.fields;
        return issue
    });
}

function secondsToDhm(seconds) {
    seconds = Number(seconds);
    var d = Math.floor(seconds / (3600*8));
    var h = Math.floor(seconds % (3600*8) / 3600);
    var m = Math.floor(seconds % 3600 / 60);

    var dDisplay = d > 0 ? d + "d " : "";
    var hDisplay = h > 0 ? h + "h " : "";
    var mDisplay = m > 0 ? m + "m" : "";
    return dDisplay + hDisplay + mDisplay;
}
