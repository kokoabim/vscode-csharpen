namespace CSharpDotNetProject;

public class Example
{
    public string A { get; set; }
    public required string B { get; set; }
    [Key]
    public string? B_With_one_attribute { get; set; }
    [Key]
    [Display]
    public string? B_With_two_attributes { get; set; }
    [Key]
    [Display]
    [MaxLength(10)]
    public string? B_With_many_attributes { get; set; }
    public required string C { get; set; }
    [Key]
    public string? C_With_one_attribute { get; set; }
    [Key]
    [Display]
    [Stringed("has a ] and [ in here")]
    public string? C_With_three_attributes { get; set; }
    [Key]
    [Display]
    [MaxLength(10)]
    public string? C_With_many_attributes { get; set; }
}
