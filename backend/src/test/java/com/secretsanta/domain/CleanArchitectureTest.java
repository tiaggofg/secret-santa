package com.secretsanta.domain;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

@AnalyzeClasses(packages = "com.secretsanta", importOptions = ImportOption.DoNotIncludeTests.class)
class CleanArchitectureTest {

    @ArchTest
    static final ArchRule domainShouldNotDependOnFrameworksOrOuterLayers =
            noClasses()
                    .that()
                    .resideInAPackage("com.secretsanta.domain..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage(
                            "org.springframework..",
                            "org.mongodb..",
                            "com.mongodb..",
                            "io.mongock..",
                            "com.fasterxml.jackson..",
                            "jakarta..",
                            "com.secretsanta.application..",
                            "com.secretsanta.infrastructure..",
                            "com.secretsanta.web..");
}
