import { DynamicModule, Module } from '@nestjs/common';
import { ConnectionWithDriver, Neo4jConfig } from './neo4j-config.interface';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Connection } from 'cypher-query-builder';
import { NEO4J_CONFIG, NEO4J_CONNECTION } from './neo4j.constants';
import { createDatabaseConfig, ConnectionError } from './neo4j.utils';
import { QueryRepository } from './noe4j.service';

@Module({})
export class Neo4jModule {
  static forRootAsync(customConfig?: Neo4jConfig): DynamicModule {
    return {
      module: Neo4jModule,
      imports: [ConfigModule],
      global: true,
      providers: [
        QueryRepository,
        {
          provide: NEO4J_CONFIG,
          inject: [ConfigService],
          useFactory: (configService: ConfigService) =>
            createDatabaseConfig(configService, customConfig),
        },
        {
          provide: NEO4J_CONNECTION,
          inject: [NEO4J_CONFIG],
          useFactory: async (config: Neo4jConfig) => {
            try {
              const { host, scheme, port, username, password } = config;
              const connection = new Connection(`${scheme}://${host}:${port}`, {
                username,
                password,
              }) as ConnectionWithDriver;

              await (connection.driver as any).verifyConnectivity();
              return connection;
            } catch (error) {
              throw new ConnectionError(error);
            }
          },
        },
      ],
      exports: [QueryRepository, NEO4J_CONNECTION],
    };
  }
}
