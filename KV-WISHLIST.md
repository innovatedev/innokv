Things deno kv doesn't support but probably should

- [ ] Retrieve a records expiresIn and ttl
- [ ] partial key matches... might not be possible, but would be huge win:
  - kv.list({start: ["user", FILTER_VALUE_ANY, "profile"], prefix:
    "user.profile."})
  - Instead of having many indexes to do filters for parts, we could just use
    proper data strucutres that would be easier to maintain.
  - should work with sqlite as it uses binary strings for keys, and a simple
    like query could be used to filter out the unwanted keys.
  - might not be so simple with foundation db implementation used by deno deploy
- [ ]
