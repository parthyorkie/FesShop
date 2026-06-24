# Node.js Backend Rules

## 📝 Prompt Logging (AUTOMATIC — NO REMINDER NEEDED)
- **Log EVERY prompt as the very first action**, before or after answering
- Never skip logging, even for short replies or follow-up messages
- Log format: date header → time → full verbatim prompt → context → result → files → status → tags
- Always add a new dated section (`### 📅 Month DD, YYYY`) if one doesn't exist for today
- Increment the prompt number (`Prompt #N`) per day, sequentially
- Include IST timestamp (`HH:MM IST`) for each prompt entry
- Update the `*Last Updated*` line at the bottom of the file after each entry

## Architecture
- Use Controller → Service → Repository pattern

## Code Quality
- Use async/await
- Avoid duplication
- Modular code

## Security
- Validate inputs
- Use JWT
- Prevent NoSQL injection

## Database
- Use indexing
- Use soft delete
- Use ObjectId relations

## Pagination
- Always implement page & limit

## Performance
- Use lean()
- Use projection