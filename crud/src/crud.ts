import { Operation } from '@cuillere/core'

export interface Crud {
  [k: string]: Provider | Database | Schema | Table
}

export interface Provider {
  [k: string]: Database | Schema | Table
}

export interface Database {
  [k: string]: Schema | Table
}

export interface Schema {
  [k: string]: Table
}

export interface Table {
  [k: string]: (...args: any[]) => Operation
}
