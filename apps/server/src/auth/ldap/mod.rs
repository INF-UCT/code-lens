mod client;

use serde::Deserialize;
use simple_ldap::SimpleDN;

pub use client::{Ldap, LdapConfigData};

#[derive(Debug, Deserialize)]
pub struct UserEntry {
    pub dn: SimpleDN,
}

#[derive(Debug, Deserialize)]
pub struct UserInfoEntry {
    pub dn: SimpleDN,
    pub cn: Option<String>,
    pub mail: Option<String>,
}

#[derive(Debug)]
pub struct UserInfo {
    pub dn: String,
    pub full_name: Option<String>,
    pub email: Option<String>,
}
