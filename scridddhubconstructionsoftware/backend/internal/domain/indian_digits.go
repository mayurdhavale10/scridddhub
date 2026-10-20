package domain

import (
	"fmt"
	"strings"
)

// IndianDigits groups a whole number the Indian way: 304920 → "3,04,920", 5948878 → "59,48,878".
func IndianDigits(n int64) string {
	sign := ""
	if n < 0 {
		sign, n = "-", -n
	}
	s := fmt.Sprintf("%d", n)
	if len(s) <= 3 {
		return sign + s
	}
	head, tail := s[:len(s)-3], s[len(s)-3:]
	var parts []string
	for len(head) > 2 {
		parts = append([]string{head[len(head)-2:]}, parts...)
		head = head[:len(head)-2]
	}
	if head != "" {
		parts = append([]string{head}, parts...)
	}
	return sign + strings.Join(parts, ",") + "," + tail
}
