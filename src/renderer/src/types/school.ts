export interface OidcUrl {
  omschrijving: string
  url: string
  domain_hint?: string
}

export interface School {
  uuid: string
  naam: string
  plaats: string
  oidcurls: OidcUrl[]
}

export interface SchoolsResponse {
  instellingen: School[]
}
