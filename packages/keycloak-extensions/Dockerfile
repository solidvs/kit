# Builds the extension JAR with Maven inside a container (ADR-0018); scripts/build.mjs exports it
# to dist/. Nobody needs Java or Maven installed.
FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
COPY src src
RUN --mount=type=cache,target=/root/.m2 mvn -B -q package

FROM scratch
COPY --from=build /build/target/solidvs-keycloak-extensions.jar /
