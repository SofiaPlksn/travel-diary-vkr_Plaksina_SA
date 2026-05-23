package com.traveldiary.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class TokenStoreService {

    private final RedisTemplate<String, Object> redisTemplate;

    @Value("${redis.ttl.password-reset}")
    private long passwordResetTtlSeconds;

    @Value("${redis.ttl.email-confirm}")
    private long emailConfirmTtlSeconds;

    public String createPasswordResetToken(String email) {
        String token = UUID.randomUUID().toString();
        Duration ttl = Duration.ofSeconds(passwordResetTtlSeconds);

        redisTemplate.opsForValue().set("pwd-reset:token:" + token, email, ttl);
        redisTemplate.opsForValue().set("pwd-reset:email:" + email, token, ttl);

        log.info("Password reset token created for email={}, TTL={}min", email, ttl.toMinutes());
        return token;
    }

    public String getEmailByPasswordResetToken(String token) {
        Object value = redisTemplate.opsForValue().get("pwd-reset:token:" + token);
        return value != null ? value.toString() : null;
    }

    public void invalidatePasswordResetToken(String token, String email) {
        redisTemplate.delete("pwd-reset:token:" + token);
        redisTemplate.delete("pwd-reset:email:" + email);
        log.debug("Password reset token invalidated for email={}", email);
    }

    public boolean hasActivePasswordResetToken(String email) {
        return Boolean.TRUE.equals(redisTemplate.hasKey("pwd-reset:email:" + email));
    }

    public String getActivePasswordResetToken(String email) {
        Object value = redisTemplate.opsForValue().get("pwd-reset:email:" + email);
        return value != null ? value.toString() : null;
    }

    public String createEmailConfirmToken(String email) {
        String token = UUID.randomUUID().toString();
        Duration ttl = Duration.ofSeconds(emailConfirmTtlSeconds);

        redisTemplate.opsForValue().set("email-confirm:token:" + token, email, ttl);

        log.info("Email confirmation token created for email={}, TTL={}h", email, ttl.toHours());
        return token;
    }

    public String confirmEmail(String token) {
        String key = "email-confirm:token:" + token;
        Object value = redisTemplate.opsForValue().get(key);
        if (value == null) return null;

        redisTemplate.delete(key);
        log.info("Email confirmed for email={}", value);
        return value.toString();
    }
}
