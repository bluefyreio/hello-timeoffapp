/*
 *
 * */

"use strict";

var express   = require('express'),
    router    = express.Router(),
    validator = require('validator'),
    Promise   = require('bluebird'),
    moment    = require('moment'),
    config    = require('../config'),
    _         = require('underscore');

// Make sure that current user is authorized to deal with settings
router.all(/.*/, require('../middleware/ensure_user_is_admin'));


router.get('/general/', function(req, res){

  res.locals.custom_java_script.push(
    '/js/settings_general.js'
  );

  res.locals.custom_css.push(
    '/css/bootstrap-datepicker3.standalone.css'
  );

  var model = req.app.get('db_model');
  var company;

  req.user.getCompany({
    include : [
      { model : model.BankHoliday, as : 'bank_holidays' },
      { model : model.LeaveType, as : 'leave_types' },
    ],
    order : [
      [{model: model.BankHoliday, as : 'bank_holidays'}, 'date' ],
      [{model: model.LeaveType, as : 'leave_types'}, 'name' ],
    ],
  })
  .then(function(c){
    company = c;
    return company.promise_schedule();
  })
  .then(function(schedule){
    res.render('general_settings', {
      company   : company,
      schedule  : schedule,
      countries : config.get('countries'),
    });
  });
});

router.post('/company/', function(req, res){

    var name              = validator.trim(req.param('name')),
        country_code      = validator.trim(req.param('country')),
        date_format       = validator.trim(req.param('date_format')),
        share_all_absences= validator.toBoolean(
          req.param('share_all_absences')
        );

    if (!validator.isAlphanumeric(country_code)){
      req.session.flash_error('Country should contain only letters and numbers');
    }

    // In case of validation error redirect back to edit form
    if ( req.session.flash_has_errors() ) {
      return res.redirect_with_session('/settings/general/');
    }

    req.user.getCompany()

    // Validate provided date format
    .then(function(company){

      if ( _.indexOf( company.get_available_date_formats(), date_format ) < 0 ) {
        var error_msg = 'Unknown date format was provided';
        req.session.flash_error(error_msg);
        throw new Error(error_msg);
      }

      return Promise.resolve( company );
    })

    .then(function(company){
        company.name              = name;
        company.country           = country_code;
        company.share_all_absences= share_all_absences;
        company.date_format       = date_format;

        return company.save();
    })
    .then(function(){
        req.session.flash_message('Company was successfully updated');
        return res.redirect_with_session('/settings/general/');
    })
    .catch(function(error){
        console.error(
            'An error occurred when trying to edit company for user ' + req.user.id
            + ' : ' + error
        );

        req.session.flash_error(
            'Failed to update company details, please contact customer service'
        );

        return res.redirect_with_session('/settings/general/');
    });
});

router.post('/schedule/', function(req, res){

  var company, schedule, user,
      model = req.app.get('db_model');

  req.user.getCompany()

    // Obtain scheduler object
    .then(function(c){
      company = c;

      if ( ! req.body.user_id) {
        // We are dealing with company wide schedule: easy
        return company.promise_schedule();
      }

      // Rest is attempt to fetch user specific schedule for given user
      return company.getUsers({
        where : {
          id : validator.trim( req.body.user_id ),
        }
      })
      .then(function(u){
        user = u.pop();

        if ( ! user) {
          throw new Error(
            "Failed to find user "+req.body.user_id+" for company "+company.id
          );
        }

        return user.promise_schedule_I_obey();
      })
      .then(function(sch){
        if (sch.is_user_specific()) {
          // User specific schedule exists in database
          return Promise.resolve(sch);
        }

        // No user specific schedule in database: create in memory default instance
        return model.Schedule
          .promise_to_build_default_for({ user_id : user.id });
      });
    })

    // Update schedule object
    .then(function(sch){
      schedule = sch;

      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        .forEach(function(day){ schedule.set(day, req.body[day]) });

      if (schedule.is_user_specific() && _.has(req.body, 'revoke_user_specific_schedule') ) {
        return schedule.destroy();
      } else {
        return schedule.save();
      }
    })

    // Action is successfully done
    .then(function(){
      req.session.flash_message( schedule.is_user_specific()
        ? 'Schedule for user was saved'
        : 'Schedule for company was saved'
      );
    })

    // Action failed
    .catch(function(error){
      console.error('An error occurred while saving schedule: ' + error);
      req.session.flash_error( schedule.is_user_specific()
        ? 'Failed to save user schedule'
        : 'Failed to save company schedule'
      );

    })

    // Depending on context redirect user to particular page
    .finally(function(){
      res.redirect_with_session(schedule.is_user_specific()
        ? (user ? '/users/edit/'+user.id+'/schedule/' : '/users/')
        : '/settings/general/'
      );
    });
});


router.get('/departments/', function(req, res) {

    // Add JS that is specific only to current page
    res.locals.custom_java_script.push('/js/departments.js');

    var company_for_template,
      model = req.app.get('db_model');

    req.user.getCompany({
          include : [{
            model : model.User,
            as    : 'users',
            where : model.User.get_active_user_filter(),
          }],
          order : [
            [ {model : model.User, as : 'users'}, 'lastname' ]
          ]
        })
        .then(function(company){
            company_for_template = company;
            return company.getDepartments({
                include : [
                    { model : model.User, as : 'users' },
                ],
                // Explicitly order departments as all actions with them rely on
                // their order within current company
                order : [
                    [ model.Department.default_order_field() ]
                ],
            });
        })
        .then(function(departments){

            var allowance_options = [{ value : 0, caption : 'None'}],
                allowance = 0.5;
            while (allowance <= 50) {
                allowance_options.push( {value : allowance, caption : allowance} );
                allowance = allowance + 0.5;
            }

            res.render('departments', {
                title             : 'Departments settings',
                departments       : departments,
                company           : company_for_template,
                allowance_options : allowance_options,
            });
        });
});

router.post('/departments/', function(req, res){

    var name              = validator.trim(req.param('name')),
        country_code      = validator.trim(req.param('country')),
        model             = req.app.get('db_model');

    req.user.getCompany({
        include : [
            {model : model.Department, as : 'departments'},
            {model : model.User, as : 'users'}
        ],
        order : [
            [ {model : model.Department, as : 'departments'}, model.Department.default_order_field() ]
        ],
    })

    .then(function(company){

        var promise_new_department = Promise.resolve(1);

        if (validator.trim(req.param('name__new'))) {
            var attributes = get_and_validate_department({
                req             : req,
                suffix          : 'new',
                company         : company,
                department_name : 'New department'
            });
            if ( req.session.flash_has_errors() ) {
                return Promise.resolve(1);
            }
            attributes.companyId = company.id;
            promise_new_department = model.Department.create(attributes);
        }

        return Promise.all([
            promise_new_department,
            _.map(

            company.departments,
            function(department, index){

                var attributes = get_and_validate_department({
                    req             : req,
                    suffix          : index,
                    company         : company,
                    department_name : department.name,
                });

                // If there were any validation errors: do not update department
                // (it affects all departments, that is if one department failed
                // validation - all departments are not to be updated)
                if ( req.session.flash_has_errors() ) {
                    return Promise.resolve(1);
                }

                return department.updateAttributes(attributes);
            }

            ) // End of map that create department update promises
        ]);
    })

    .then(function(){
        if ( req.session.flash_has_errors() ) {
            return res.redirect_with_session('/settings/departments/');
        } else {
            req.session.flash_message('Changes to departments were saved');
            return res.redirect_with_session('/settings/departments/');
        }
    })

    .catch(function(error){
        console.error(
            'An error occurred when trying to edit departments by user '+req.user.id
            + ' : ' + error
        );

        req.session.flash_error(
            'Failed to update departments details, please contact customer service'
        );

        return res.redirect_with_session('/settings/departments/');
    });
});

router.post('/departments/delete/:department_number/', function(req, res){

    // department_number is a index number of department to be removed based
    // on the list of department on the page, this is not an ID
    var department_number = req.param('department_number');

    var model = req.app.get('db_model');

    if (!validator.isInt(department_number)) {
        console.error(
            'User '+req.user.id+' submited non-int department number '
                +department_number
        );

        req.session.flash_error('Cannot remove department: wronge parameters');

        return res.redirect_with_session('/settings/departments/');
    }

    req.user.getCompany({
        include : [
            {
                model : model.Department,
                as : 'departments',
                include : {
                    model : model.User,
                    as : 'users',
                }
            },
        ],
        order : [
            [ {model : model.Department, as : 'departments'}, model.Department.default_order_field() ]
        ],
    })
    .then(function(company){
      var department_to_remove = company.departments[ department_number ];

      // Check if user specify valid department number
      if (! department_to_remove) {

        console.error(
          'User '+req.user.id+' tried to remove non-existing department number'
          +department_number+' out of '+company.departments.length
        );

        req.session.flash_error('Cannot remove department: wronge parameters');

        throw new Error(
          'User '+req.user.id+' tried to remove non-existing department number'
          +department_number+' out of '+company.departments.length
        );
      }

      if (department_to_remove.users.length > 0){
        req.session.flash_error(
          'Cannot remove department '+department_to_remove.name
            +' as it still has '
            +department_to_remove.users.length+' users.'
        );

        throw new Error('Department still has users');
      }

      return department_to_remove.destroy();
    })
    .then(function(){
        req.session.flash_message('Department was successfully removed');
        return res.redirect_with_session('/settings/departments/');
    })
    .catch(function(error){

      console.error(
          'An error occurred when trying to edit departments by user '+req.user.id
          + ' : ' + error
      );

      return res.redirect_with_session('/settings/departments/');
    });
});

router.post('/bankholidays/', function(req,res){
    var name = validator.trim(req.param('name')),
        date = validator.trim(req.param('date')),
        model= req.app.get('db_model');

    req.user.getCompany({
        include : [{ model : model.BankHoliday, as : 'bank_holidays' }],
        order : [[{model: model.BankHoliday, as : 'bank_holidays'}, 'date' ]],
    })
    .then(function(company){

        var promise_new_bank_holiday = Promise.resolve(1);

        if (validator.trim(req.param('name__new'))) {
            var attributes = get_and_validate_bank_holiday({
                req       : req,
                suffix    : 'new',
                item_name : 'New Bank Holiday'
            });
            if ( req.session.flash_has_errors() ) {
                return Promise.resolve(1);
            }
            attributes.companyId = company.id;
            promise_new_bank_holiday = model.BankHoliday.create(attributes);

        }

        return Promise.all([
            promise_new_bank_holiday,
            _.map(

            company.bank_holidays,
            function(bank_holiday, index){

                  var attributes = get_and_validate_bank_holiday({
                      req       : req,
                      suffix    : index,
                      item_name : bank_holiday.name,
                  });

                  // If there were any validation errors: do not update bank holiday
                  // (it affects all bank holidays, that is if one failed
                  // validation - all bank holidays are not to be updated)
                  if ( req.session.flash_has_errors() ) {
                      return Promise.resolve(1);
                  }

                  return bank_holiday.updateAttributes(attributes);
              }

            ) // End of map that create bank_holiday update promises
        ]);
    })
    .then(function(){

        if ( req.session.flash_has_errors() ) {
            return res.redirect_with_session('/settings/general/');
        } else {
            req.session.flash_message('Changes to bank holidays were saved');
            return res.redirect_with_session('/settings/general/');
        }
    })
    .catch(function(error){
        console.error(
            'An error occurred when trying to edit Bank holidays by user '+req.user.id
            + ' : ' + error
        );

        req.session.flash_error(
            'Failed to update bank holidayes details, please contact customer service'
        );

        return res.redirect_with_session('/settings/general/');
    });

});


router.post('/bankholidays/delete/:bank_holiday_number/', function(req, res){

    // bank_holiday_number is a index number of bank_holiday to be removed based
    // on the list of bank holidays on the page, this is not an ID
    var bank_holiday_number = req.param('bank_holiday_number');

    var model = req.app.get('db_model');

    if (!validator.isInt(bank_holiday_number)) {
        console.error(
            'User '+req.user.id+' submited non-int bank holiday number '
                +bank_holiday_number
        );

        req.session.flash_error('Cannot remove bank holiday: wronge parameters');

        return res.redirect_with_session('/settings/general/');
    }

    req.user.getCompany({
        include : [{ model : model.BankHoliday, as : 'bank_holidays' }],
        order : [[{model: model.BankHoliday, as : 'bank_holidays'}, 'date' ]],
    })
    .then(function(company){
        var bank_holiday_to_remove = company.bank_holidays[ bank_holiday_number ];

        // Check if user specify valid department number
        if (! bank_holiday_to_remove) {

            console.error(
                'User '+req.user.id+' tried to remove non-existing bank holiday number'
                +bank_holiday_number+' out of '+company.bank_holidays.length
            );

            req.session.flash_error('Cannot remove bank holiday: wronge parameters');

            return res.redirect_with_session('/settings/general/');
        }

        return bank_holiday_to_remove.destroy();
    })
    .then(function(){
        req.session.flash_message('Bank holiday was successfully removed');
        return res.redirect_with_session('/settings/general/');
    });
});

router.post('/leavetypes', function(req, res){

    var model = req.app.get('db_model');

    req.user.getCompany({
        include : [{ model : model.LeaveType, as : 'leave_types' }],
        order : [[{model: model.LeaveType, as : 'leave_types'}, 'name' ]],
    })
    .then(function(company){

        var promise_new_leave_type = Promise.resolve(1);

        if (validator.trim(req.param('name__new'))) {
            var attributes = get_and_validate_leave_type({
                req       : req,
                suffix    : 'new',
                item_name : 'New Leave Type'
            });
            if ( req.session.flash_has_errors() ) {
                return Promise.resolve(1);
            }
            attributes.companyId = company.id;
            promise_new_leave_type = model.LeaveType.create(attributes);
        }

        return Promise.all([
            promise_new_leave_type,
            _.map(

            company.leave_types,
            function(leave_type, index){

                var attributes = get_and_validate_leave_type({
                    req       : req,
                    suffix    : index,
                    item_name : leave_type.name,
                });

                // If there were any validation errors: do not update leave type
                // (it affects all leave types, that is if one failed
                // validation - all leave types are not to be updated)
                if ( req.session.flash_has_errors() ) {
                    return Promise.resolve(1);
                }

                return leave_type.updateAttributes(attributes);
            }

            ) // End of map that create leave type update promises
        ]);
    })
    .then(function(){
        if ( ! req.session.flash_has_errors() ) {
            req.session.flash_message('Changes to leave types were saved');
        }
        return res.redirect_with_session('/settings/general/');
    })
    .catch(function(error){
        console.error(
            'An error occurred when trying to edit Leave types by user '+req.user.id
            + ' : ' + error
        );

        req.session.flash_error(
            'Failed to update leave types details, please contact customer service'
        );

        return res.redirect_with_session('/settings/general/');
    });

});


router.post('/leavetypes/delete/:leave_type_number/', function(req, res){

    // leave_type_number is an index number of leave_type to be removed based
    // on the list of leave types on the page, this is not an ID
    var leave_type_number = req.param('leave_type_number');

    var model = req.app.get('db_model');

    if (!validator.isInt(leave_type_number)) {
        console.error(
            'User '+req.user.id+' submited non-int leave_type number '
                +bank_holiday_number
        );

        req.session.flash_error('Cannot remove leave_type: wronge parameters');

        return res.redirect_with_session('/settings/general/');
    }

    req.user.getCompany({
        include : [{
            model : model.LeaveType,
            as : 'leave_types',
            include : [{model: model.Leave, as: 'leaves'}],
        }],
        order : [[{model: model.LeaveType, as : 'leave_types'}, 'name' ]],
    })
    .then(function(company){
        var leave_type_to_remove = company.leave_types[ leave_type_number ];

        // Check if user specify valid department number
        if (! leave_type_to_remove) {

            req.session.flash_error('Cannot remove leave type: wronge parameters');

            throw new Error(
              'User '+req.user.id+' tried to remove non-existing leave type number'
              +leave_type_number+' out of '+company.leave_types.length
            );


        // Check if there exist leaves for current type and if so, do not remove it
        } else if (leave_type_to_remove.leaves.length > 0) {

            req.session.flash_error('Cannot remove leave type: type is in use');

            throw new Error('Failed to remove Leave type because it is in used.');
        }

        return leave_type_to_remove.destroy();
    })
    .then(function(){
        req.session.flash_message('Leave type was successfully removed');
        return res.redirect_with_session('/settings/general/');
    })
    .catch(function(error){
        console.error(
            'An error occurred when trying to remove leave type by user' + req.user.id
            + ' : ' + error
        );

        req.session.flash_error(
          'Failed to remove Leave Type'
        );

        return res.redirect_with_session('/settings/general/');
    });
});

/*
 * Export all data related to current user's Company,
 * the output data structure is suitable to for feeding
 * into company restore action.
 *
 * */
router.post('/company/export/', function(req, res){

  req.user
    .get_company_for_export()
    .then(function(company){

      res.attachment(
        company.name_for_machine()+'_'+moment().format('YYYYMMDD-hhmmss')+'.json'
      );

      res.send(JSON.stringify(company));
    });
});

router.get('/company/authentication/', function(req, res){

  req.user
    .getCompany()
    .then(function(company){
      res.render('settings_company_authentication', {
        company     : company,
        ldap_config : company.get('ldap_auth_config'),
      });
    });
});


router.post('/company/authentication/', function(req, res){

  req.user
    .getCompany()
    .then(function(company){

      var parameters = get_and_validate_ldap_auth_configuration({
        req : req,
      });

      // Updaye in memory Company object but do not save changes until new LDAP
      // configuration checked against current user
      // (this is needed to prevent situation when admin by lock herself out)
      company.set('ldap_auth_config', parameters.ldap_config);
      company.setDataValue('ldap_auth_enabled', parameters.ldap_auth_enabled);

      var ldap_server = company.get_ldap_server();

      var auth_func = Promise.promisify(ldap_server.authenticate.bind(ldap_server));

      return auth_func(req.user.email, parameters.password_to_check)
        .then(function(){
          return company.save();
        })
        .catch(function(error){
          error = new Error(
            "Failed to validate new LDAP settings with provided current user password. "+error
          );
          error.show_to_user = true;
          throw error;
        });
    })

    .then(function(){
      if ( req.session.flash_has_errors() ) {
        return res.redirect_with_session('/settings/company/authentication/');
      } else {
        req.session.flash_message('LDAP configuration was updated');
        return res.redirect_with_session('/settings/company/authentication/');
      }
    })
    .catch(function(error){
      console.error(
        "An error occured while trying to update LDAP configuration: %s", error
      );

      req.session.flash_error(
        'Failed to update LDAP configuration. ' +
        ( error.show_to_user ? 'Error: '+error : 'Please contact customer service')
      );

      return res.redirect_with_session('/settings/company/authentication/');
    });
});

function get_and_validate_department(args) {
  var req             = args.req,
      index           = args.suffix,
      company         = args.company,
      department_name = args.department_name;

  // Get user parameters
  var name = validator.trim(req.param('name__'+index)),
      allowance = validator.trim(req.param('allowance__'+index)),
      include_public_holidays = validator.toBoolean(
          req.param('include_public_holidays__'+index)
      ),
      boss_id = validator.trim(req.param('boss_id__'+index));

  // Validate provided parameters
  //
  // New allowance should be from range of (0;50]
  if (!validator.isFloat(allowance)) {
    req.session.flash_error(
      'New allowance for '+department_name+' should be numeric'
    );
  } else if (!((0 <= allowance) && (allowance <= 50))) {
    req.session.flash_error(
      'New allowance for '+department_name+' should be between 0.5 and 50 days'
    );
  }
  // New manager ID should be numeric and from within
  // current company
  if (!validator.isNumeric( boss_id ) ) {
    req.session.flash_error(
      'New boss reference for '+department_name+' should be numeric'
    );
  } else if (_.contains(
    _.map(
      company.users, function(user){ return user.id; }),
      boss_id
  )) {
    req.session.flash_error(
      'New boss for '+department_name+' is unknown'
    );
  }

  return {
    name                    : name,
    allowance               : allowance,
    include_public_holidays : include_public_holidays,
    bossId                  : boss_id,
  };
}

function get_and_validate_bank_holiday(args) {
  var req       = args.req,
      index     = args.suffix,
      item_name = args.item_name;

  // Get user parameters
  var name = validator.trim(req.param('name__'+index)),
      date = validator.trim(req.param('date__'+index));

  // Validate provided parameters
  //
  // Note, we allow users to put whatever they want into the name.
  // The XSS defence is in the templates

  date = req.user.company.normalise_date( date );

  if ( ! validator.isDate(date) ) {
    req.session.flash_error(
      'New day for '+item_name+' should be date'
    );
  }

  return {
    name : name,
    date : date,
  };
}

function get_and_validate_leave_type(args) {
  var req       = args.req,
      index     = args.suffix,
      item_name = args.item_name;

  // Get user parameters
  var name  = validator.trim(req.param('name__'+index)),
      color = validator.trim(req.param('color__'+index)) || '#f1f1f1',
      limit = validator.trim(req.param('limit__'+index)) || 0,
      use_allowance = validator.toBoolean(
          req.param('use_allowance__'+index)
      );

  // Validate provided parameters

  if ( ! validator.isHexColor(color)) {
    req.session.flash_error(
      'New color for '+item_name+' should be color code'
    );
  }
  if ( ! validator.isNumeric(limit) ){
    req.session.flash_error(
      'New limit for '+item_name+' should be a valide number'
    );
  } else if ( limit < 0) {
    req.session.flash_error(
      'New limit for '+item_name+' should be positive number or 0'
    );
  }

  return {
    name          : name,
    color         : color,
    use_allowance : use_allowance,
    limit         : limit,
  };
}

function get_and_validate_ldap_auth_configuration(args) {
  var req = args.req;

  // Get parameters
  //
  var url           = validator.trim(req.param('url')),
  binddn            = validator.trim(req.param('binddn')),
  bindcredentials   = validator.trim(req.param('bindcredentials')),
  searchbase        = validator.trim(req.param('searchbase')),
  ldap_auth_enabled = validator.toBoolean(req.param('ldap_auth_enabled')),

  // Fetch the password of current user that is valid in LDAP system
  password_to_check = validator.trim(req.param('password_to_check'));

  // Validate provided parameters

  if (!validator.matches(url, /^ldaps?:\/\/[a-z0-9\.\-]+:\d+$/i)){
    req.session.flash_error(
      "URL to LDAP server must be of following format: 'ldap://HOSTNAME:PORT'"
    );
  }

  if ( req.session.flash_has_errors() ) {
    var error = new Error("Validation failed");
    error.show_to_user = true;
    throw error;
  }

  // Return the configuration object
  return {
    ldap_config : {
      url             : url,
      binddn          : binddn,
      bindcredentials : bindcredentials,
      searchbase      : searchbase,
    },
    ldap_auth_enabled : ldap_auth_enabled,
    password_to_check : password_to_check,
  };
}

module.exports = router;
