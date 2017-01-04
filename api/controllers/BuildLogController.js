const authorizeUserForBuild = ({ user, build }) => {
  return User.findOne(user.id).populate("sites").then(user => {
    const siteIndex = user.sites.findIndex(site => {
      return site.id === build.site
    })
    if (siteIndex < 0) {
      const error = new Error("Unauthorized")
      error.code = 403
      throw error
    }
  })
}

module.exports = {
  create: (req, res) => {
    Build.findOne(req.param("build_id")).then(build => {
      if (!build) {
        const error = new Error("Not found")
        error.code = 404
        throw error
      }
      return BuildLog.create({
        build: build,
        output: req.param("output"),
        source: req.param("source"),
      })
    }).then(build => {
      res.json(build)
    }).catch(err => {
      if (err.code === 404) {
        res.notFound()
      } else {
        res.serverError(err)
      }
    })
  },

  find: (req, res) => {
    let build

    Build.findOne(req.param("build_id")).populate("buildLogs").then(model => {
      build = model

      if (!build) {
        const error = new Error("Not found")
        error.code = 404
        throw error
      }

      return authorizeUserForBuild({
        build: build,
        user: req.user,
      })
    }).then(() => {
      res.json(build.buildLogs)
    }).catch(err => {
      if (err.code === 404) {
        res.notFound()
      } else if (err.code === 403) {
        res.forbidden()
      } else {
        res.serverError(err)
      }
    })
  },

  _config: {
    actions: false,
    shortcuts: false,
    rest: false,
  },
}