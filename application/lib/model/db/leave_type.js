"use strict";

module.exports = function(sequelize, DataTypes) {
    var LeaveType = sequelize.define("LeaveType", {
        // TODO add validators!
        name : {
            type      : DataTypes.STRING,
            allowNull : false
        },
        color : {
            type         : DataTypes.STRING,
            allowNull    : false,
            defaultValue : '#ffffff',
        },
        use_allowance : {
            type         : DataTypes.BOOLEAN,
            allowNull    : false,
            defaultValue : true,
        },
        limit : {
            type         : DataTypes.INTEGER,
            allowNull    : false,
            defaultValue : 0,
        },
    }, {
        classMethods: {
            associate : function( models ) {
                LeaveType.belongsTo(models.Company, {as : 'company'});
                LeaveType.hasMany(models.Leave, {as : 'leaves', foreignKey : 'leaveTypeId'});
            },

            generate_leave_types : function(args){
                var company = args.company;

                return LeaveType.bulkCreate([
                    {
                        name : 'Holiday',
                        color : '#22AA66',
                        companyId : company.id,
                    },
                    {
                        name : 'Sick Leave',
                        color : '#459FF3',
                        companyId : company.id,
                        limit : 10,
                    },
                ])
            },
        },

        instanceMethods : {

        }
    });

    return LeaveType;
};
