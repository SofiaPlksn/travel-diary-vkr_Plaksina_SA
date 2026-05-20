package com.traveldiary.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

@Configuration
public class AppConfig {

    @Bean
    public RestTemplate restTemplate() {
        System.setProperty("sun.net.http.allowRestrictedHeaders", "true");

        org.springframework.http.client.SimpleClientHttpRequestFactory factory =
                new org.springframework.http.client.SimpleClientHttpRequestFactory() {
                    @Override
                    protected void prepareConnection(java.net.HttpURLConnection connection, String httpMethod) throws java.io.IOException {
                        super.prepareConnection(connection, httpMethod);
                        connection.setRequestProperty("User-Agent", "TravelDiaryApp/1.0 (contact@traveldiary.app)");
                        connection.setRequestProperty("Accept-Language", "ru,en;q=0.9");
                    }
                };

        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(15_000);

        return new RestTemplate(factory);
    }
    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .configure(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS, false)
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }
}
