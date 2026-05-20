package com.traveldiary;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.io.PrintStream;
import java.nio.charset.StandardCharsets;

@SpringBootApplication
@EnableScheduling
public class TravelDiaryApplication {
    public static void main(String[] args) {
        SpringApplication.run(TravelDiaryApplication.class, args);
    }
}