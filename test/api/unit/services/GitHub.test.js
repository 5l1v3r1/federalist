const expect = require('chai').expect;
const config = require('../../../../config');
const factory = require('../../support/factory');
const GitHub = require('../../../../api/services/GitHub');
const githubAPINocks = require('../../support/githubAPINocks');

describe('GitHub', () => {
  describe('.getRepository(user, owner, repository)', () => {
    it('should resolve with the repository data if the repo exists', (done) => {
      factory.user().then((user) => {
        githubAPINocks.repo({
          accessToken: user.githubAccessToken,
          owner: 'repo-owner',
          repo: 'repo-name',
          response: [200, {
            name: 'repo-name',
            owner: {
              login: 'repo-owner',
            },
            meta: {},
          }],
        });

        return GitHub.getRepository(user, 'repo-owner', 'repo-name');
      }).then((data) => {
        expect(data).to.deep.equal({
          name: 'repo-name',
          owner: {
            login: 'repo-owner',
          },
          meta: {},
        });
        done();
      }).catch(done);
    });

    it('should resolve with null if the repo does not exist', (done) => {
      factory.user().then((user) => {
        githubAPINocks.repo({
          accessToken: user.githubAccessToken,
          owner: 'repo-owner',
          repo: 'repo-name',
          response: [200, {
            message: 'Not Found',
            documentation_url: 'https://developer.github.com/v3',
          }],
        });

        return GitHub.getRepository(user, 'repo-owner', 'repo-name');
      }).then((result) => {
        expect(result.message).to.equal('Not Found');
        done();
      }).catch(done);
    });
  });

  describe('.createRepository(user, owner, repository)', () => {
    it('should create a repository for the user if the user is the owner', (done) => {
      let createRepoNock;

      factory.user().then((user) => {
        createRepoNock = githubAPINocks.createRepoForUser({
          accessToken: user.githubAccessToken,
          repo: 'repo-name',
        });

        return GitHub.createRepo(user, user.username, 'repo-name');
      }).then(() => {
        expect(createRepoNock.isDone()).to.equal(true);
        done();
      }).catch(done);
    });

    it('should create a repository for an org if the user is not the owner', (done) => {
      let createRepoNock;

      factory.user().then((user) => {
        createRepoNock = githubAPINocks.createRepoForOrg({
          accessToken: user.githubAccessToken,
          org: 'org-name',
          repo: 'repo-name',
        });

        return GitHub.createRepo(user, 'org-name', 'repo-name');
      }).then(() => {
        expect(createRepoNock.isDone()).to.equal(true);
        done();
      }).catch(done);
    });

    it('should create a user repository even if the case for the owner and username don\'t match', (done) => {
      let createRepoNock;

      factory.user().then((user) => {
        createRepoNock = githubAPINocks.createRepoForUser({
          accessToken: user.githubAccessToken,
          repo: 'repo-name',
        });

        return GitHub.createRepo(user, user.username.toUpperCase(), 'repo-name');
      }).then(() => {
        expect(createRepoNock.isDone()).to.equal(true);
        done();
      }).catch(done);
    });

    it('should reject if the user is not authorized to create a repository', (done) => {
      factory.user().then((user) => {
        githubAPINocks.createRepoForOrg({
          accessToken: user.githubAccessToken,
          org: 'org-name',
          repo: 'repo-name',
          response: [403, {
            message: 'You need admin access to the organization before adding a repository to it.',
          }],
        });

        return GitHub.createRepo(user, 'org-name', 'repo-name');
      }).catch((err) => {
        expect(err.status).to.equal(400);
        expect(err.message).to.equal('You need admin access to the organization before adding a repository to it.');
        done();
      }).catch(done);
    });

    it('should reject if the repo already exists', (done) => {
      factory.user().then((user) => {
        githubAPINocks.createRepoForOrg({
          accessToken: user.githubAccessToken,
          org: 'org-name',
          repo: 'repo-name',
          response: [422, {
            errors: [{ message: 'name already exists on this account' }],
          }],
        });

        return GitHub.createRepo(user, 'org-name', 'repo-name');
      }).catch((err) => {
        expect(err.status).to.equal(400);
        expect(err.message).to.equal('A repo with that name already exists.');
        done();
      }).catch(done);
    });
  });

  describe('.setWebhook(site, user)', () => {
    it('should set a webhook on the repository', (done) => {
      let site;
      let user;

      factory.user()
        .then((model) => {
          user = model;
          return factory.site();
        })
        .then((model) => {
          site = model;
          githubAPINocks.webhook({
            accessToken: user.githubAccessToken,
            owner: site.owner,
            repo: site.repository,
            response: 201,
          });
          return GitHub.setWebhook(site, user.id);
        })
        .then(() => {
          done();
        })
        .catch(done);
    });

    it('should resolve if the webhook already exists', (done) => {
      let site;
      let user;

      factory.user()
        .then((model) => {
          user = model;
          return factory.site();
        })
        .then((model) => {
          site = model;
          githubAPINocks.webhook({
            accessToken: user.githubAccessToken,
            owner: site.owner,
            repo: site.repository,
            response: [400, {
              errors: [{ message: 'Hook already exists on this repository' }],
            }],
          });
          return GitHub.setWebhook(site, user.id);
        })
        .then(() => {
          done();
        })
        .catch(done);
    });

    it('should reject if the user does not have admin access to the repository', (done) => {
      let site;
      let user;

      factory.user()
        .then((model) => {
          user = model;
          return factory.site();
        })
        .then((model) => {
          site = model;
          githubAPINocks.webhook({
            accessToken: user.githubAccessToken,
            owner: site.owner,
            repo: site.repository,
            response: [404, {
              message: 'Not Found',
            }],
          });
          return GitHub.setWebhook(site, user.id);
        })
        .then(() => {
          throw new Error('Expected admin access error');
        })
        .catch((err) => {
          expect(err.status).to.equal(400);
          expect(err.message).to.equal('You do not have admin access to this repository');
          done();
        })
        .catch(done);
    });
  });

  describe('.validateUser(accessToken)', () => {
    it('should resolve if the user is on a whitelisted team', (done) => {
      githubAPINocks.userOrganizations({
        accessToken: '123abc',
        organizations: [{ id: config.passport.github.organizations[0] }],
      });

      GitHub.validateUser('123abc').then(() => {
        done();
      }).catch(done);
    });

    it('should reject if the user is not on a whitelisted team', (done) => {
      const FAKE_INVALID_ORG_ID = 4598345;

      githubAPINocks.userOrganizations({
        accessToken: '123abc',
        organizations: [{ id: FAKE_INVALID_ORG_ID }],
      });

      GitHub.validateUser('123abc').catch((err) => {
        expect(err.message).to.equal('Unauthorized');
        done();
      });
    });

    it('should reject if access token is not a valid GitHub access token', (done) => {
      githubAPINocks.userOrganizations({
        accessToken: '123abc',
        response: 403,
      });

      GitHub.validateUser('123abc').catch(() => done());
    });
  });

  describe('.getBranch', () => {
    let promised;
    let mockGHRequest;

    beforeEach(() => {
      mockGHRequest = null;
      const userPromise = factory.user();
      const sitePromise = factory.site({ users: Promise.all([userPromise]) });

      promised = Promise.props({
        user: userPromise,
        site: sitePromise,
      });
    });

    it('returns a branch based on the supplied parameters', (done) => {
      promised.then((values) => {
        const { owner, repository } = values.site;
        const branch = 'master';

        mockGHRequest = githubAPINocks.getBranch({
          owner,
          repo: repository,
          branch,
        });

        return GitHub.getBranch(values.user, owner, repository, branch);
      })
      .then((branchInfo) => {
        expect(branchInfo).to.exist;
        expect(branchInfo.name).to.exist;
        expect(branchInfo.commit).to.exist;
        expect(mockGHRequest.isDone()).to.be.true;
        done();
      })
      .catch(done);
    });

    it('returns an error if branch is not defined', (done) => {
      promised.then((values) => {
        const { owner, repository } = values.site;
        const branch = 'master';

        mockGHRequest = githubAPINocks.getBranch({
          owner,
          repo: repository,
          branch,
          response: [400, {
            errors: [{ message: 'Not Found' }],
          }],
        });

        return GitHub.getBranch(values.user, owner, repository)
          .catch((err) => {
            expect(err.code).to.equal(400);
            done();
          });
      })
      .catch(done);
    });
  });

  describe('.getRepositories', () => {
    it('returns a list of a user repositories', (done) => {
      const accessToken = 'token';

      githubAPINocks.getRepositories({ accessToken });
      githubAPINocks.getRepositories({ accessToken, page: 2 });
      githubAPINocks.getRepositories({ accessToken, page: 3 });
      GitHub.getRepositories(accessToken)
        .then((repos) => {
          expect(repos.length).to.equal(101);
          done();
        })
        .catch(done);
    });

    it('returns an exception', (done) => {
      const accessToken = 'invalid';

      GitHub.getRepositories(accessToken)
        .catch((err) => {
          expect(err.code).to.exist;
          done();
        });
    });
  });

  describe('.getCollaborators', () => {
    it('returns a list of a repo collaborators', (done) => {
      const accessToken = 'token';
      const owner = 'owner';
      const repository = 'repo';

      githubAPINocks.getCollaborators({ accessToken, owner, repository });
      githubAPINocks.getCollaborators({ accessToken, owner, repository, page: 2 });
      githubAPINocks.getCollaborators({ accessToken, owner, repository, page: 3 });

      GitHub.getCollaborators(accessToken, owner, repository)
        .then((collabs) => {
          expect(collabs.length).to.equal(101);
          done();
        })
        .catch(done);
    });

    it('returns an exception', (done) => {
      const accessToken = 'invalid';

      GitHub.getRepositories(accessToken)
        .catch((err) => {
          expect(err.code).to.exist;
          done();
        });
    });
  });

  describe('.getOrganizationMembers', () => {
    it('returns a list of all organization members', (done) => {
      const accessToken = 'token';
      const organization = 'testOrg';

      githubAPINocks.getOrganizationMembers({ accessToken, organization });
      githubAPINocks.getOrganizationMembers({ accessToken, organization, page: 2 });
      githubAPINocks.getOrganizationMembers({ accessToken, organization, page: 3 });
      GitHub.getOrganizationMembers(accessToken, organization)
        .then((members) => {
          expect(members.length).to.equal(101);
          done();
        })
        .catch(done);
    });

    it('returns an exception', (done) => {
      const accessToken = 'token';
      const organization = 'failOrg';

      githubAPINocks.getOrganizationMembers({ accessToken, organization });
      GitHub.getOrganizationMembers(accessToken, organization)
        .catch((err) => {
          expect(err.code).to.exist;
          done();
        });
    });

    it('returns a list of organization admin members', (done) => {
      const accessToken = 'token';
      const organization = 'testOrg';

      githubAPINocks.getOrganizationMembers({ accessToken, organization, role: 'admin' });
      githubAPINocks.getOrganizationMembers({ accessToken, organization, role: 'admin', page: 2 });
      githubAPINocks.getOrganizationMembers({ accessToken, organization, role: 'admin', page: 3 });
      GitHub.getOrganizationMembers(accessToken, organization, 'admin')
        .then((members) => {
          expect(members.length).to.equal(3);
          done();
        })
        .catch(done);
    });

    it('returns a list of organization non-admin members', (done) => {
      const accessToken = 'token';
      const organization = 'testOrg';

      githubAPINocks.getOrganizationMembers({ accessToken, organization, role: 'member' });
      githubAPINocks.getOrganizationMembers({ accessToken, organization, role: 'member', page: 2 });
      githubAPINocks.getOrganizationMembers({ accessToken, organization, role: 'member', page: 3 });
      GitHub.getOrganizationMembers(accessToken, organization, 'member')
        .then((members) => {
          expect(members.length).to.equal(98);
          done();
        })
        .catch(done);
    });
  });

  describe('.getTeamMembers', () => {
    /* eslint-disable camelcase */
    it('returns a branch based on the supplied parameters', (done) => {
      const accessToken = 'token';
      const team_id = 12345;

      githubAPINocks.getTeamMembers({ accessToken, team_id });
      githubAPINocks.getTeamMembers({ accessToken, team_id, page: 2 });
      githubAPINocks.getTeamMembers({ accessToken, team_id, page: 3 });
      GitHub.getTeamMembers(accessToken, team_id)
        .then((members) => {
          expect(members.length).to.equal(102);
          done();
        })
        .catch(done);
    });

    it('returns a branch based on the supplied parameters', (done) => {
      const accessToken = 'token';
      const team_id = 'failTeam';

      githubAPINocks.getTeamMembers({ accessToken, team_id });
      GitHub.getTeamMembers(accessToken, team_id)
        .catch((err) => {
          expect(err.code).to.exist;
          done();
        });
    });
    /* eslint-enable camelcase */
  });

  describe('.sendCreateGithubStatusRequest', () => {
    it('sends a github status request and passes on last attempt', (done) => {
      const accessToken = 'token';
      const context = `federalist-${config.app.app_env}/build`;
      const targetURL = `${config.app.hostname}/sites/1/builds/1/logs`;
      const options = {
        owner: 'test-owner',
        repo: 'test-repo',
        sha: '12344',
        state: 'success',
        targetURL,
        target_url: targetURL,
        context,
      };

      const failOptions = Object.assign({}, options);
      failOptions.response = [404, 'File not found'];

      githubAPINocks.status(failOptions);
      githubAPINocks.status(failOptions);
      githubAPINocks.status(failOptions);
      githubAPINocks.status(failOptions);
      const statusNock = githubAPINocks.status(options);

      GitHub.sendCreateGithubStatusRequest(accessToken, options)
        .then(() => {
          expect(statusNock.isDone()).to.be.true;
          done();
        }).catch(done);
    });

    it('sends a github status request and failOptions', (done) => {
      const accessToken = 'token';
      const context = `federalist-${config.app.app_env}/build`;
      const targetURL = `${config.app.hostname}/sites/1/builds/1/logs`;
      const options = {
        owner: 'test-owner',
        repo: 'test-repo',
        sha: '12344',
        state: 'success',
        targetURL,
        target_url: targetURL,
        context,
      };

      const failOptions = Object.assign({}, options);
      failOptions.response = [404, 'File not found'];

      githubAPINocks.status(failOptions);
      githubAPINocks.status(failOptions);
      githubAPINocks.status(failOptions);
      githubAPINocks.status(failOptions);
      githubAPINocks.status(failOptions);

      GitHub.sendCreateGithubStatusRequest(accessToken, options)
        .catch((err) => {
          expect(err.status).to.equal('Not Found');
          expect(err.message).to.equal('File not found');
          done();
        }).catch(done);
    });
  });
});
